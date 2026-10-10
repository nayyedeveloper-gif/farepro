package com.farepro.driver.data.local

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.doublePreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

data class ActiveTripSession(
    val tripId: String?,
    val running: Boolean,
    val paused: Boolean,
    val cumulativeMeters: Double,
    val startedAtMs: Long,
    val pausedAccumMs: Long,
    val pauseStartedMs: Long?,
    val ratePerKm: Int,
    val minimumFare: Int,
    val nightMultiplier: Double,
)

@Singleton
class TripSessionStore @Inject constructor(
    @Named("trip_session") private val dataStore: DataStore<Preferences>,
) {
    private val tripIdKey = stringPreferencesKey("trip_id")
    private val runningKey = booleanPreferencesKey("running")
    private val pausedKey = booleanPreferencesKey("paused")
    private val metersKey = doublePreferencesKey("cumulative_m")
    private val startedAtKey = longPreferencesKey("started_at")
    private val pausedAccumKey = longPreferencesKey("paused_accum")
    private val pauseStartedKey = longPreferencesKey("pause_started")
    private val rateKey = longPreferencesKey("rate_per_km")
    private val minFareKey = longPreferencesKey("min_fare")
    private val nightKey = doublePreferencesKey("night_mult")
    private val permissionsDoneKey = booleanPreferencesKey("permissions_setup_done")

    val sessionFlow: Flow<ActiveTripSession?> = dataStore.data.map { prefs ->
        if (prefs[runningKey] != true) return@map null
        ActiveTripSession(
            tripId = prefs[tripIdKey],
            running = true,
            paused = prefs[pausedKey] == true,
            cumulativeMeters = prefs[metersKey] ?: 0.0,
            startedAtMs = prefs[startedAtKey] ?: System.currentTimeMillis(),
            pausedAccumMs = prefs[pausedAccumKey] ?: 0L,
            pauseStartedMs = prefs[pauseStartedKey],
            ratePerKm = (prefs[rateKey] ?: 1500L).toInt(),
            minimumFare = (prefs[minFareKey] ?: 2000L).toInt(),
            nightMultiplier = prefs[nightKey] ?: 1.2,
        )
    }

    suspend fun current(): ActiveTripSession? = sessionFlow.first()

    suspend fun save(session: ActiveTripSession) {
        dataStore.edit {
            if (session.tripId != null) it[tripIdKey] = session.tripId else it.remove(tripIdKey)
            it[runningKey] = session.running
            it[pausedKey] = session.paused
            it[metersKey] = session.cumulativeMeters
            it[startedAtKey] = session.startedAtMs
            it[pausedAccumKey] = session.pausedAccumMs
            if (session.pauseStartedMs != null) {
                it[pauseStartedKey] = session.pauseStartedMs
            } else {
                it.remove(pauseStartedKey)
            }
            it[rateKey] = session.ratePerKm.toLong()
            it[minFareKey] = session.minimumFare.toLong()
            it[nightKey] = session.nightMultiplier
        }
    }

    suspend fun clear() {
        dataStore.edit {
            it.remove(tripIdKey)
            it[runningKey] = false
            it.remove(pausedKey)
            it.remove(metersKey)
            it.remove(startedAtKey)
            it.remove(pausedAccumKey)
            it.remove(pauseStartedKey)
        }
    }

    suspend fun setPermissionsSetupDone(done: Boolean) {
        dataStore.edit { it[permissionsDoneKey] = done }
    }

    val permissionsSetupDoneFlow: Flow<Boolean> =
        dataStore.data.map { it[permissionsDoneKey] == true }
}
