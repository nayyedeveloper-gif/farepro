package com.farepro.driver.meter

import android.content.Context
import com.farepro.driver.data.local.ActiveTripSession
import com.farepro.driver.data.local.TripLedgerStore
import com.farepro.driver.data.local.TripSessionStore
import com.farepro.driver.domain.FareCalculator
import com.farepro.driver.domain.model.DemandCatalog
import com.farepro.driver.domain.model.DemandCatalogItem
import com.farepro.driver.domain.model.DemandLine
import com.farepro.driver.domain.model.FareRates
import com.farepro.driver.domain.model.PathPoint
import com.farepro.driver.domain.model.TripReceipt
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
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

data class MeterSessionState(
    val tripId: String? = null,
    val running: Boolean = false,
    val paused: Boolean = false,
    val distanceKm: Double = 0.0,
    val fareMmk: Int = 2000,
    val baseFareMmk: Int = 2000,
    val demandMmk: Int = 0,
    val demands: List<DemandLine> = emptyList(),
    val demandCatalog: List<DemandCatalogItem> = DemandCatalog.DEFAULT,
    val elapsedSec: Int = 0,
    val rates: FareRates = FareRates(),
    val startedAtMs: Long = 0L,
    val pausedAccumMs: Long = 0L,
    val pauseStartedMs: Long? = null,
    val startLat: Double? = null,
    val startLng: Double? = null,
    val plateNumber: String = "7K-0000",
)

/**
 * Survives ViewModel death, process kill, and device reboot until trip is completed.
 */
@Singleton
class MeterSessionManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val store: TripSessionStore,
    private val ledger: TripLedgerStore,
    private val tracker: DriverLocationTracker,
    private val locationController: LocationController,
    private val json: Json,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val _state = MutableStateFlow(MeterSessionState())
    val state: StateFlow<MeterSessionState> = _state.asStateFlow()

    private val _lastReceipt = MutableStateFlow<TripReceipt?>(null)
    val lastReceipt: StateFlow<TripReceipt?> = _lastReceipt.asStateFlow()

    init {
        scope.launch {
            store.current()?.let { restore(it, startServices = false) }
        }
        scope.launch {
            ledger.plateFlow.collect { plate ->
                _state.update { it.copy(plateNumber = plate) }
            }
        }
        scope.launch {
            tracker.fix.collect { fix ->
                val s = _state.value
                if (!s.running || s.paused) return@collect
                val km = fix.cumulativeDistanceM / 1000.0
                val base = FareCalculator.calculate(km, s.rates)
                val demand = DemandCatalog.activeTotal(s.demands)
                val fare = base + demand
                val rounded = (km * 1000).toInt() / 1000.0
                _state.update {
                    it.copy(
                        distanceKm = rounded,
                        baseFareMmk = base,
                        demandMmk = demand,
                        fareMmk = fare,
                        startLat = it.startLat ?: fix.lat,
                        startLng = it.startLng ?: fix.lng,
                    )
                }
                persist()
                MeterBubbleService.updateKm(context, rounded, fare)
            }
        }
    }

    fun setRates(rates: FareRates) {
        _state.update {
            val base = if (!it.running) rates.minimumFare else FareCalculator.calculate(it.distanceKm, rates)
            val demand = DemandCatalog.activeTotal(it.demands)
            it.copy(
                rates = rates,
                baseFareMmk = base,
                demandMmk = demand,
                fareMmk = base + demand,
            )
        }
    }

    fun setDemandCatalog(catalog: List<DemandCatalogItem>) {
        val items = catalog.ifEmpty { DemandCatalog.DEFAULT }
        _state.update { it.copy(demandCatalog = items) }
    }

    fun bindTrip(tripId: String?) {
        _state.update { it.copy(tripId = tripId) }
    }

    /**
     * Add a catalog demand. Same code can only be used once per trip
     * (even after remove-with-warning) to stop casual add/remove toggling.
     * @return false if this code was already used on the trip
     */
    fun addDemand(item: DemandCatalogItem): Boolean {
        val s = _state.value
        if (!s.running) return false
        if (s.demands.any { it.code == item.code }) return false
        val line = DemandLine(
            code = item.code,
            name = item.name,
            amountMmk = item.amountMmk,
        )
        applyDemands(s.demands + line)
        return true
    }

    /**
     * Remove an active demand — keeps a WARNING line on the receipt.
     */
    fun removeDemandWithWarning(lineId: String): Boolean {
        val s = _state.value
        val target = s.demands.firstOrNull { it.id == lineId && it.isActive } ?: return false
        val updated = s.demands.map {
            if (it.id == target.id) {
                it.copy(
                    removedAtMs = System.currentTimeMillis(),
                    removalWarning = true,
                )
            } else {
                it
            }
        }
        applyDemands(updated)
        return true
    }

    private fun applyDemands(demands: List<DemandLine>) {
        val demand = DemandCatalog.activeTotal(demands)
        _state.update {
            it.copy(
                demands = demands,
                demandMmk = demand,
                fareMmk = it.baseFareMmk + demand,
            )
        }
        if (_state.value.running) persist()
    }

    fun start(tripId: String? = _state.value.tripId) {
        tracker.resetTripMeter()
        tracker.setTripMeterActive(true)
        val now = System.currentTimeMillis()
        val rates = _state.value.rates
        val catalog = _state.value.demandCatalog
        val fix = tracker.fix.value
        val startLat = fix.lat.takeIf { fix.timestampMs > 0 }
        val startLng = fix.lng.takeIf { fix.timestampMs > 0 }
        _state.value = MeterSessionState(
            tripId = tripId,
            running = true,
            paused = false,
            distanceKm = 0.0,
            fareMmk = rates.minimumFare,
            baseFareMmk = rates.minimumFare,
            demandMmk = 0,
            demands = emptyList(),
            demandCatalog = catalog,
            elapsedSec = 0,
            rates = rates,
            startedAtMs = now,
            pausedAccumMs = 0,
            pauseStartedMs = null,
            startLat = startLat,
            startLng = startLng,
            plateNumber = _state.value.plateNumber,
        )
        if (tripId != null) locationController.goOnTrip(tripId) else locationController.goOnline()
        MeterBubbleService.show(context, 0.0, rates.minimumFare)
        persist()
        _lastReceipt.value = null
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
        tracker.resetTripMeter()
        val rates = _state.value.rates
        val catalog = _state.value.demandCatalog
        val plate = _state.value.plateNumber
        // Full idle reset — previous trip fare/demand/time/km must not linger on Home.
        _state.value = MeterSessionState(
            tripId = null,
            running = false,
            paused = false,
            distanceKm = 0.0,
            fareMmk = rates.minimumFare,
            baseFareMmk = rates.minimumFare,
            demandMmk = 0,
            demands = emptyList(),
            demandCatalog = catalog,
            elapsedSec = 0,
            rates = rates,
            startedAtMs = 0L,
            pausedAccumMs = 0L,
            pauseStartedMs = null,
            startLat = null,
            startLng = null,
            plateNumber = plate,
        )
        scope.launch { store.clear() }
        if (clearBubble) MeterBubbleService.clearTrip(context)
    }

    /** End trip, save receipt to ledger, return it for UI. */
    suspend fun completeTrip(
        orgName: String = "",
        driverName: String = "",
    ): TripReceipt {
        tickElapsed()
        val s = _state.value
        val endFix = tracker.fix.value
        val path = tracker.path.value.map { PathPoint(it.first, it.second) }
        val endedAt = System.currentTimeMillis()
        val duration = if (s.running) {
            val pauseExtra = s.pauseStartedMs?.let { endedAt - it } ?: 0L
            ((endedAt - s.startedAtMs - s.pausedAccumMs - pauseExtra) / 1000).toInt().coerceAtLeast(0)
        } else {
            s.elapsedSec
        }
        val km = if (s.running) tracker.cumulativeKm() else s.distanceKm
        val base = FareCalculator.calculate(km, s.rates)
        val demand = DemandCatalog.activeTotal(s.demands)
        val fare = base + demand
        val rounded = kotlin.math.round(km * 1000.0) / 1000.0
        val syncStatus = when {
            s.tripId.isNullOrBlank() -> TripReceipt.SYNC_LOCAL
            else -> TripReceipt.SYNC_PENDING
        }

        val receipt = TripReceipt(
            id = UUID.randomUUID().toString(),
            serverTripId = s.tripId,
            startedAtMs = s.startedAtMs.takeIf { it > 0 } ?: endedAt,
            endedAtMs = endedAt,
            durationSec = duration,
            distanceKm = rounded,
            fareMmk = fare,
            baseFareMmk = base,
            extrasMmk = demand,
            demandMmk = demand,
            demands = s.demands,
            ratePerKm = s.rates.ratePerKm,
            startLat = s.startLat ?: path.firstOrNull()?.lat,
            startLng = s.startLng ?: path.firstOrNull()?.lng,
            endLat = endFix.lat.takeIf { endFix.timestampMs > 0 } ?: path.lastOrNull()?.lat,
            endLng = endFix.lng.takeIf { endFix.timestampMs > 0 } ?: path.lastOrNull()?.lng,
            startAddress = formatPoint(s.startLat ?: path.firstOrNull()?.lat, s.startLng ?: path.firstOrNull()?.lng, "Pickup"),
            endAddress = formatPoint(
                endFix.lat.takeIf { endFix.timestampMs > 0 } ?: path.lastOrNull()?.lat,
                endFix.lng.takeIf { endFix.timestampMs > 0 } ?: path.lastOrNull()?.lng,
                "Dropoff",
            ),
            path = path,
            plateNumber = s.plateNumber.ifBlank { ledger.plateNumber() },
            driverName = driverName,
            orgName = orgName,
            syncStatus = syncStatus,
        )

        stop(clearBubble = true)
        ledger.add(receipt)
        _lastReceipt.value = receipt
        locationController.goOnline()
        return receipt
    }

    fun clearLastReceipt() {
        _lastReceipt.value = null
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
        val base = FareCalculator.calculate(km, rates)
        val demands = decodeDemands(session.demandJson)
        val demand = DemandCatalog.activeTotal(demands)
        tracker.restoreTripMeter(session.cumulativeMeters, active = session.running && !session.paused)
        scope.launch {
            val plate = ledger.plateFlow.first()
            _state.value = MeterSessionState(
                tripId = session.tripId,
                running = session.running,
                paused = session.paused,
                distanceKm = (km * 1000).toInt() / 1000.0,
                baseFareMmk = base,
                demandMmk = demand,
                demands = demands,
                demandCatalog = _state.value.demandCatalog,
                fareMmk = base + demand,
                elapsedSec = 0,
                rates = rates,
                startedAtMs = session.startedAtMs,
                pausedAccumMs = session.pausedAccumMs,
                pauseStartedMs = session.pauseStartedMs,
                plateNumber = plate,
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
                    demandJson = encodeDemands(s.demands),
                ),
            )
        }
    }

    private fun encodeDemands(demands: List<DemandLine>): String =
        runCatching { json.encodeToString(demands) }.getOrDefault("[]")

    private fun decodeDemands(raw: String): List<DemandLine> =
        runCatching { json.decodeFromString<List<DemandLine>>(raw) }.getOrDefault(emptyList())

    private fun formatPoint(lat: Double?, lng: Double?, fallback: String): String {
        if (lat == null || lng == null) return fallback
        return "%.5f, %.5f".format(lat, lng)
    }
}
