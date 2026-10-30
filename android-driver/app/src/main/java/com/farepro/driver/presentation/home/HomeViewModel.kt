package com.farepro.driver.presentation.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.farepro.driver.data.local.RatesCache
import com.farepro.driver.data.repository.DriverRepository
import com.farepro.driver.domain.GeoMath
import com.farepro.driver.domain.model.DemandCatalogItem
import com.farepro.driver.domain.model.DemandLine
import com.farepro.driver.domain.model.AppResult
import com.farepro.driver.domain.model.TripReceipt
import com.farepro.driver.location.DriverLocationTracker
import com.farepro.driver.location.LocationController
import com.farepro.driver.meter.MeterSessionManager
import com.farepro.driver.presentation.components.MapPoint
import com.farepro.driver.presentation.theme.Brand
import com.farepro.driver.sync.TripSyncManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject

data class HomeUiState(
    val walletBalance: Int = 0,
    val driverName: String = "",
    val ending: Boolean = false,
    val online: Boolean = true,
    val pendingSync: Int = 0,
    val error: String? = null,
    val demandNotice: String? = null,
)

data class MeterDisplay(
    val running: Boolean = false,
    val paused: Boolean = false,
    val fareMmk: Int = 2000,
    val baseFareMmk: Int = 2000,
    val demandMmk: Int = 0,
    val demands: List<DemandLine> = emptyList(),
    val demandCatalog: List<DemandCatalogItem> = emptyList(),
    val distanceKm: Double = 0.0,
    val elapsedSec: Int = 0,
    val plateNumber: String = "7K-0000",
    val ratePerKm: Int = 1500,
)

data class MapDisplay(
    val center: MapPoint = MapPoint(16.8661, 96.1951),
    val hasFix: Boolean = false,
    val accuracyM: Int = 0,
    val speedKmh: Int = 0,
    val path: List<MapPoint> = emptyList(),
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val repo: DriverRepository,
    private val meter: MeterSessionManager,
    private val tracker: DriverLocationTracker,
    private val locationController: LocationController,
    private val ratesCache: RatesCache,
    private val sync: TripSyncManager,
    private val json: Json,
) : ViewModel() {
    private val _ui = MutableStateFlow(HomeUiState())
    val ui = _ui.asStateFlow()

    val meterDisplay = meter.state
        .map {
            MeterDisplay(
                running = it.running,
                paused = it.paused,
                fareMmk = it.fareMmk,
                baseFareMmk = it.baseFareMmk,
                demandMmk = it.demandMmk,
                demands = it.demands,
                demandCatalog = it.demandCatalog,
                distanceKm = kotlin.math.round(it.distanceKm * 100.0) / 100.0,
                elapsedSec = it.elapsedSec,
                plateNumber = it.plateNumber,
                ratePerKm = it.rates.ratePerKm,
            )
        }
        .distinctUntilChanged()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), MeterDisplay())

    private val _map = MutableStateFlow(MapDisplay())
    val mapDisplay = _map.asStateFlow()

    private var tickJob: Job? = null
    private var lastMapLat = 0.0
    private var lastMapLng = 0.0
    private var lastPathSize = 0

    init {
        viewModelScope.launch {
            meter.setRates(ratesCache.loadRates())
            meter.setDemandCatalog(ratesCache.loadDemandCatalog())
            _ui.update { it.copy(walletBalance = ratesCache.loadWallet()) }
            runCatching {
                val bundle = repo.loadFareBundle()
                ratesCache.saveRates(bundle.rates)
                ratesCache.saveDemandCatalog(bundle.demandCatalog)
                meter.setRates(bundle.rates)
                meter.setDemandCatalog(bundle.demandCatalog)
            }
            when (val w = repo.wallet()) {
                is AppResult.Ok -> {
                    ratesCache.saveWallet(w.value.balanceMmk)
                    _ui.update { it.copy(walletBalance = w.value.balanceMmk) }
                }
                is AppResult.Err -> Unit
            }
            repo.loadUser()?.let { user ->
                _ui.update { it.copy(driverName = user.displayName) }
            }
        }
        viewModelScope.launch {
            sync.online.collect { on -> _ui.update { it.copy(online = on) } }
        }
        viewModelScope.launch {
            sync.pendingCount.collect { n -> _ui.update { it.copy(pendingSync = n) } }
        }
        viewModelScope.launch {
            meter.state.collect { s ->
                if (s.running && !s.paused) ensureTicker() else if (!s.running) tickJob?.cancel()
            }
        }
        viewModelScope.launch {
            tracker.fix.collect { fix ->
                if (fix.timestampMs <= 0L) return@collect
                val movedEnough = lastMapLat == 0.0 ||
                    GeoMath.distanceMeters(lastMapLat, lastMapLng, fix.lat, fix.lng) >= 10.0
                if (!movedEnough) {
                    val acc = fix.accuracyM.toInt()
                    val spd = fix.speedKmh.toInt()
                    val cur = _map.value
                    if (acc != cur.accuracyM || spd != cur.speedKmh) {
                        _map.update { it.copy(hasFix = true, accuracyM = acc, speedKmh = spd) }
                    }
                    return@collect
                }
                lastMapLat = fix.lat
                lastMapLng = fix.lng
                _map.update {
                    it.copy(
                        center = MapPoint(fix.lat, fix.lng, "You"),
                        hasFix = true,
                        accuracyM = fix.accuracyM.toInt(),
                        speedKmh = fix.speedKmh.toInt(),
                    )
                }
            }
        }
        viewModelScope.launch {
            tracker.path.collect { path ->
                if (path.size == lastPathSize && path.isNotEmpty()) return@collect
                lastPathSize = path.size
                val points = path.takeLast(160).map { MapPoint(it.first, it.second) }
                _map.update { it.copy(path = points) }
            }
        }
        meter.restoreFromDiskIfNeeded()
        locationController.goOnline()
    }

    fun startTrip() {
        locationController.goOnline()
        meter.start(null)
        ensureTicker()
        _ui.update { it.copy(error = null, demandNotice = null) }
    }

    fun pauseOrResume() {
        val s = meter.state.value
        if (!s.running) return
        if (s.paused) {
            meter.resume()
            ensureTicker()
        } else {
            meter.pause()
        }
    }

    fun addDemand(item: DemandCatalogItem) {
        if (!meter.state.value.running) {
            _ui.update { it.copy(demandNotice = "Start trip first") }
            return
        }
        val ok = meter.addDemand(item)
        _ui.update {
            it.copy(
                demandNotice = if (ok) {
                    null
                } else {
                    "${item.name} already used on this trip"
                },
            )
        }
    }

    fun removeDemand(lineId: String) {
        meter.removeDemandWithWarning(lineId)
        _ui.update { it.copy(demandNotice = null) }
    }

    fun clearDemandNotice() {
        _ui.update { it.copy(demandNotice = null) }
    }

    fun endTrip(onReceipt: (TripReceipt) -> Unit) {
        if (!meter.state.value.running) return
        viewModelScope.launch {
            _ui.update { it.copy(ending = true, error = null) }
            val receipt = meter.completeTrip(
                orgName = Brand.APP_NAME,
                driverName = _ui.value.driverName,
            )
            if (receipt.syncStatus == TripReceipt.SYNC_PENDING && sync.online.value) {
                receipt.serverTripId?.let { id ->
                    val demandJson = runCatching { json.encodeToString(receipt.demands) }.getOrDefault("[]")
                    when (
                        repo.completeTrip(
                            id,
                            receipt.distanceKm,
                            receipt.fareMmk,
                            demandMmk = receipt.effectiveDemandMmk,
                            demandJson = demandJson,
                        )
                    ) {
                        is AppResult.Ok -> sync.flushPending()
                        is AppResult.Err -> Unit
                    }
                }
            }
            lastPathSize = 0
            _map.update { it.copy(path = emptyList()) }
            _ui.update { it.copy(ending = false) }
            onReceipt(receipt)
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
