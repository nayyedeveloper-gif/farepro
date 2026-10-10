package com.farepro.driver.presentation.meter

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.farepro.driver.data.repository.DriverRepository
import com.farepro.driver.domain.model.AppResult
import com.farepro.driver.domain.model.FareRates
import com.farepro.driver.location.DriverLocationTracker
import com.farepro.driver.location.LocationController
import com.farepro.driver.meter.MeterSessionManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

data class MeterUiState(
    val running: Boolean = false,
    val paused: Boolean = false,
    val distanceKm: Double = 0.0,
    val fareMmk: Int = 2000,
    val elapsedSec: Int = 0,
    val speedKmh: Int = 0,
    val accuracyM: Float = 0f,
    val lat: Double? = null,
    val lng: Double? = null,
    val path: List<Pair<Double, Double>> = emptyList(),
    val rates: FareRates = FareRates(),
    val error: String? = null,
    val saving: Boolean = false,
    val message: String? = null,
)

@HiltViewModel
class MeterViewModel @Inject constructor(
    private val repo: DriverRepository,
    private val tracker: DriverLocationTracker,
    private val locationController: LocationController,
    private val meter: MeterSessionManager,
) : ViewModel() {
    private val _ui = MutableStateFlow(MeterUiState())
    val ui = _ui.asStateFlow()

    private var tickJob: Job? = null
    private var tripId: String? = null

    val liveFix = tracker.fix.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), tracker.fix.value)

    init {
        viewModelScope.launch {
            val rates = repo.fareRates()
            meter.setRates(rates)
            _ui.update { it.copy(rates = rates, fareMmk = rates.minimumFare) }
        }
        viewModelScope.launch {
            meter.state.collect { s ->
                _ui.update {
                    it.copy(
                        running = s.running,
                        paused = s.paused,
                        distanceKm = s.distanceKm,
                        fareMmk = s.fareMmk,
                        elapsedSec = s.elapsedSec,
                        rates = s.rates,
                    )
                }
                if (s.running && !s.paused) ensureTicker() else if (!s.running) tickJob?.cancel()
            }
        }
        viewModelScope.launch {
            tracker.fix.collect { fix ->
                if (!_ui.value.running) return@collect
                _ui.update {
                    it.copy(
                        lat = fix.lat,
                        lng = fix.lng,
                        speedKmh = fix.speedKmh.toInt(),
                        accuracyM = fix.accuracyM,
                    )
                }
            }
        }
        viewModelScope.launch {
            tracker.path.collect { path ->
                _ui.update { it.copy(path = path) }
            }
        }
        meter.restoreFromDiskIfNeeded()
    }

    fun bindTrip(id: String?) {
        tripId = id
        meter.bindTrip(id)
    }

    fun start() {
        meter.start(tripId)
        ensureTicker()
        _ui.update { it.copy(error = null, message = null) }
    }

    fun pause() = meter.pause()

    fun resume() {
        meter.resume()
        ensureTicker()
    }

    fun stop() {
        tickJob?.cancel()
        meter.stop()
    }

    fun finishTrip() {
        val id = tripId ?: meter.state.value.tripId
        val distance = meter.state.value.distanceKm
        val fare = meter.state.value.fareMmk
        meter.stop()
        tickJob?.cancel()
        if (id == null) {
            locationController.goOnline()
            _ui.update { it.copy(message = "Meter stopped · $fare MMK") }
            return
        }
        viewModelScope.launch {
            _ui.update { it.copy(saving = true) }
            when (val res = repo.completeTrip(id, distance, fare)) {
                is AppResult.Ok -> {
                    locationController.goOnline()
                    _ui.update { it.copy(saving = false, message = "Trip completed · $fare MMK") }
                }
                is AppResult.Err -> _ui.update { it.copy(saving = false, error = res.message) }
            }
        }
    }

    private fun ensureTicker() {
        if (tickJob?.isActive == true) return
        tickJob = viewModelScope.launch {
            while (isActive) {
                meter.tickElapsed()
                delay(1000)
            }
        }
    }

    override fun onCleared() {
        tickJob?.cancel()
        super.onCleared()
    }
}
