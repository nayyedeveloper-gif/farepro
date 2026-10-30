package com.farepro.driver.sync

import com.farepro.driver.data.local.RatesCache
import com.farepro.driver.data.local.TripLedgerStore
import com.farepro.driver.data.repository.DriverRepository
import com.farepro.driver.domain.model.AppResult
import com.farepro.driver.domain.model.TripReceipt
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Local-first trips: always saved on device.
 * When a trip has a serverTripId and syncStatus=pending, flush to API when online.
 */
@Singleton
class TripSyncManager @Inject constructor(
    private val ledger: TripLedgerStore,
    private val repo: DriverRepository,
    private val ratesCache: RatesCache,
    private val connectivity: ConnectivityMonitor,
    private val json: Json,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val _online = MutableStateFlow(true)
    val online: StateFlow<Boolean> = _online.asStateFlow()

    private val _pendingCount = MutableStateFlow(0)
    val pendingCount: StateFlow<Int> = _pendingCount.asStateFlow()

    fun start() {
        scope.launch {
            connectivity.online.collectLatest { on ->
                _online.value = on
                if (on) {
                    refreshCaches()
                    flushPending()
                }
            }
        }
        scope.launch {
            ledger.tripsFlow.collect { trips ->
                _pendingCount.value = trips.count { it.syncStatus == TripReceipt.SYNC_PENDING }
            }
        }
    }

    suspend fun refreshCaches() {
        runCatching {
            val bundle = repo.loadFareBundle()
            ratesCache.saveRates(bundle.rates)
            ratesCache.saveDemandCatalog(bundle.demandCatalog)
        }
        when (val w = repo.wallet()) {
            is AppResult.Ok -> ratesCache.saveWallet(w.value.balanceMmk)
            is AppResult.Err -> Unit
        }
    }

    suspend fun flushPending() {
        val pending = ledger.all().filter { it.syncStatus == TripReceipt.SYNC_PENDING }
        for (trip in pending) {
            val serverId = trip.serverTripId ?: continue
            val demandJson = runCatching { json.encodeToString(trip.demands) }.getOrDefault("[]")
            when (
                repo.completeTrip(
                    serverId,
                    trip.distanceKm,
                    trip.fareMmk,
                    demandMmk = trip.effectiveDemandMmk,
                    demandJson = demandJson,
                )
            ) {
                is AppResult.Ok -> ledger.update(trip.copy(syncStatus = TripReceipt.SYNC_SYNCED))
                is AppResult.Err -> break // stop on first failure; retry next online
            }
        }
        _pendingCount.value = ledger.all().count { it.syncStatus == TripReceipt.SYNC_PENDING }
    }
}
