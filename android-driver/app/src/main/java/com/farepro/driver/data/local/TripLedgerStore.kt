package com.farepro.driver.data.local

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.farepro.driver.domain.model.DashboardStats
import com.farepro.driver.domain.model.TripReceipt
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

@Singleton
class TripLedgerStore @Inject constructor(
    @Named("trip_ledger") private val dataStore: DataStore<Preferences>,
    private val json: Json,
) {
    private val tripsKey = stringPreferencesKey("completed_trips_json")
    private val plateKey = stringPreferencesKey("plate_number")

    val tripsFlow: Flow<List<TripReceipt>> = dataStore.data.map { prefs ->
        decode(prefs[tripsKey])
    }

    suspend fun all(): List<TripReceipt> = tripsFlow.first()

    suspend fun get(id: String): TripReceipt? = all().firstOrNull { it.id == id }

    suspend fun add(receipt: TripReceipt) {
        dataStore.edit { prefs ->
            val cur = decode(prefs[tripsKey]).toMutableList()
            cur.removeAll { it.id == receipt.id }
            cur.add(0, receipt)
            prefs[tripsKey] = json.encodeToString(cur.take(500))
        }
    }

    suspend fun update(receipt: TripReceipt) {
        dataStore.edit { prefs ->
            val cur = decode(prefs[tripsKey]).toMutableList()
            val idx = cur.indexOfFirst { it.id == receipt.id }
            if (idx >= 0) cur[idx] = receipt else cur.add(0, receipt)
            prefs[tripsKey] = json.encodeToString(cur.take(500))
        }
    }

    suspend fun plateNumber(): String = dataStore.data.first()[plateKey] ?: "7K-0000"

    suspend fun setPlateNumber(plate: String) {
        dataStore.edit { it[plateKey] = plate.trim().ifBlank { "7K-0000" } }
    }

    val plateFlow: Flow<String> = dataStore.data.map { it[plateKey] ?: "7K-0000" }

    fun statsFor(trips: List<TripReceipt>, fromMs: Long = 0L, toMs: Long = Long.MAX_VALUE): DashboardStats {
        val filtered = trips.filter { it.endedAtMs in fromMs..toMs }
        val total = filtered.sumOf { it.fareMmk }
        return DashboardStats(
            totalTrips = filtered.size,
            distanceKm = filtered.sumOf { it.distanceKm },
            durationSec = filtered.sumOf { it.durationSec },
            totalAmountMmk = total,
            demandMmk = filtered.sumOf { it.effectiveDemandMmk },
            avgFareMmk = if (filtered.isEmpty()) 0 else total / filtered.size,
        )
    }

    private fun decode(raw: String?): List<TripReceipt> {
        if (raw.isNullOrBlank()) return emptyList()
        return runCatching { json.decodeFromString<List<TripReceipt>>(raw) }.getOrDefault(emptyList())
    }
}
