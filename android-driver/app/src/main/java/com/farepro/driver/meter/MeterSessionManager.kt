package com.farepro.driver.meter

import android.content.Context
import com.farepro.driver.data.local.ActiveTripSession
import com.farepro.driver.data.local.TripSessionStore
import com.farepro.driver.domain.FareCalculator
import com.farepro.driver.domain.model.FareRates
import com.farepro.driver.location.DriverLocationTracker
import com.farepro.driver.location.LocationController
import com.farepro.driver.overlay.MeterBubbleService
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

data class MeterSessionState(
    val tripId: String? = null,
    val running: Boolean = false,
    val paused: Boolean = false,
    val distanceKm: Double = 0.0,
    val fareMmk: Int = 2000,
    val elapsedSec: Int = 0,
    val rates: FareRates = FareRates(),
    val startedAtMs: Long = 0L,
    val pausedAccumMs: Long = 0L,
    val pauseStartedMs: Long? = null,
)

/**
 * Survives ViewModel death, process kill, and device reboot until trip is completed.
 */
@Singleton
class MeterSessionManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val store: TripSessionStore,
    private val tracker: DriverLocationTracker,
    private val locationController: LocationController,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val _state = MutableStateFlow(MeterSessionState())
    val state: StateFlow<MeterSessionState> = _state.asStateFlow()

    init {
        scope.launch {
            store.current()?.let { restore(it, startServices = false) }
        }
        scope.launch {
            tracker.fix.collect { fix ->
                val s = _state.value
                if (!s.running || s.paused) return@collect
                val km = fix.cumulativeDistanceM / 1000.0
                val fare = FareCalculator.calculate(km, s.rates)
                val rounded = (km * 1000).toInt() / 1000.0
                _state.update {
                    it.copy(distanceKm = rounded, fareMmk = fare)
                }
                persist()
                MeterBubbleService.updateKm(context, rounded, fare)
            }
        }
    }

    fun setRates(rates: FareRates) {
        _state.update {
            it.copy(
                rates = rates,
                fareMmk = if (!it.running) rates.minimumFare else FareCalculator.calculate(it.distanceKm, rates),
            )
        }
    }

    fun bindTrip(tripId: String?) {
        _state.update { it.copy(tripId = tripId) }
    }

    fun start(tripId: String? = _state.value.tripId) {
        tracker.resetTripMeter()
        tracker.setTripMeterActive(true)
        val now = System.currentTimeMillis()
        val rates = _state.value.rates
        _state.value = MeterSessionState(
            tripId = tripId,
            running = true,
            paused = false,
            distanceKm = 0.0,
            fareMmk = rates.minimumFare,
            elapsedSec = 0,
            rates = rates,
            startedAtMs = now,
            pausedAccumMs = 0,
            pauseStartedMs = null,
        )
        if (tripId != null) locationController.goOnTrip(tripId) else locationController.goOnline()
        MeterBubbleService.show(context, 0.0, rates.minimumFare)
        persist()
    }

    fun pause() {
        val now = System.currentTimeMillis()
        tracker.setTripMeterActive(false)
        _state.update { it.copy(paused = true, pauseStartedMs = now) }
        persist()
        MeterBubbleService.updateKm(context, _state.value.distanceKm, _state.value.fareMmk, paused = true)
    }

    fun resume() {
        val s = _state.value
        val extra = s.pauseStartedMs?.let { System.currentTimeMillis() - it } ?: 0L
        tracker.setTripMeterActive(true)
        _state.update {
            it.copy(
                paused = false,
                pausedAccumMs = it.pausedAccumMs + extra,
                pauseStartedMs = null,
            )
        }
        persist()
        MeterBubbleService.updateKm(context, _state.value.distanceKm, _state.value.fareMmk, paused = false)
    }

    fun stop(clearBubble: Boolean = true) {
        tracker.setTripMeterActive(false)
        val km = tracker.cumulativeKm()
        val fare = FareCalculator.calculate(km, _state.value.rates)
        _state.update {
            it.copy(
                running = false,
                paused = false,
                distanceKm = (km * 1000).toInt() / 1000.0,
                fareMmk = fare,
                pauseStartedMs = null,
            )
        }
        scope.launch { store.clear() }
        if (clearBubble) MeterBubbleService.hide(context)
    }

    fun tickElapsed() {
        val s = _state.value
        if (!s.running) return
        val pauseExtra = s.pauseStartedMs?.let { System.currentTimeMillis() - it } ?: 0L
        val elapsed = ((System.currentTimeMillis() - s.startedAtMs - s.pausedAccumMs - pauseExtra) / 1000)
            .toInt()
            .coerceAtLeast(0)
        _state.update { it.copy(elapsedSec = elapsed) }
    }

    /** Called after reboot / cold start when an unfinished trip exists. */
    fun resumeAfterBoot(session: ActiveTripSession) {
        restore(session, startServices = true)
    }

    fun restoreFromDiskIfNeeded() {
        scope.launch {
            val session = store.current() ?: return@launch
            if (!_state.value.running) {
                restore(session, startServices = true)
            }
        }
    }

    private fun restore(session: ActiveTripSession, startServices: Boolean) {
        val rates = FareRates(
            ratePerKm = session.ratePerKm,
            minimumFare = session.minimumFare,
            nightMultiplier = session.nightMultiplier,
        )
        val km = session.cumulativeMeters / 1000.0
        tracker.restoreTripMeter(session.cumulativeMeters, active = session.running && !session.paused)
        _state.value = MeterSessionState(
            tripId = session.tripId,
            running = session.running,
            paused = session.paused,
            distanceKm = (km * 1000).toInt() / 1000.0,
            fareMmk = FareCalculator.calculate(km, rates),
            elapsedSec = 0,
            rates = rates,
            startedAtMs = session.startedAtMs,
            pausedAccumMs = session.pausedAccumMs,
            pauseStartedMs = session.pauseStartedMs,
        )
        tickElapsed()
        if (startServices && session.running) {
            val id = session.tripId
            if (id != null) locationController.goOnTrip(id) else locationController.goOnline()
            MeterBubbleService.show(
                context,
                _state.value.distanceKm,
                _state.value.fareMmk,
                paused = session.paused,
            )
        }
    }

    private fun persist() {
        val s = _state.value
        if (!s.running) return
        scope.launch {
            store.save(
                ActiveTripSession(
                    tripId = s.tripId,
                    running = true,
                    paused = s.paused,
                    cumulativeMeters = tracker.cumulativeKm() * 1000.0,
                    startedAtMs = s.startedAtMs,
                    pausedAccumMs = s.pausedAccumMs,
                    pauseStartedMs = s.pauseStartedMs,
                    ratePerKm = s.rates.ratePerKm,
                    minimumFare = s.rates.minimumFare,
                    nightMultiplier = s.rates.nightMultiplier,
                ),
            )
        }
    }

}
