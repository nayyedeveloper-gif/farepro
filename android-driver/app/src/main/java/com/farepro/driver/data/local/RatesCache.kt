package com.farepro.driver.data.local

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import com.farepro.driver.domain.model.DemandCatalog
import com.farepro.driver.domain.model.DemandCatalogItem
import com.farepro.driver.domain.model.FareRates
import kotlinx.coroutines.flow.first
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

/** Cached org fare rates + demand catalog so the meter works fully offline. */
@Singleton
class RatesCache @Inject constructor(
    @Named("trip_ledger") private val dataStore: DataStore<Preferences>,
    private val json: Json,
) {
    private val rateKey = intPreferencesKey("cache_rate_per_km")
    private val minKey = intPreferencesKey("cache_min_fare")
    private val nightKey = stringPreferencesKey("cache_night_mult")
    private val nightStartKey = intPreferencesKey("cache_night_start")
    private val nightEndKey = intPreferencesKey("cache_night_end")
    private val walletKey = intPreferencesKey("cache_wallet_mmk")
    private val demandCatalogKey = stringPreferencesKey("cache_demand_catalog")

    suspend fun saveRates(rates: FareRates) {
        dataStore.edit {
            it[rateKey] = rates.ratePerKm
            it[minKey] = rates.minimumFare
            it[nightKey] = rates.nightMultiplier.toString()
            it[nightStartKey] = rates.nightStartHour
            it[nightEndKey] = rates.nightEndHour
        }
    }

    suspend fun loadRates(): FareRates {
        val p = dataStore.data.first()
        return FareRates(
            ratePerKm = p[rateKey] ?: 1500,
            minimumFare = p[minKey] ?: 2000,
            nightMultiplier = p[nightKey]?.toDoubleOrNull() ?: 1.2,
            nightStartHour = p[nightStartKey] ?: 22,
            nightEndHour = p[nightEndKey] ?: 5,
        )
    }

    suspend fun saveDemandCatalog(items: List<DemandCatalogItem>) {
        dataStore.edit {
            it[demandCatalogKey] = json.encodeToString(items)
        }
    }

    suspend fun loadDemandCatalog(): List<DemandCatalogItem> {
        val raw = dataStore.data.first()[demandCatalogKey] ?: return DemandCatalog.DEFAULT
        return runCatching { json.decodeFromString<List<DemandCatalogItem>>(raw) }
            .getOrNull()
            ?.ifEmpty { null }
            ?: DemandCatalog.DEFAULT
    }

    suspend fun saveWallet(balanceMmk: Int) {
        dataStore.edit { it[walletKey] = balanceMmk }
    }

    suspend fun loadWallet(): Int = dataStore.data.first()[walletKey] ?: 0
}
