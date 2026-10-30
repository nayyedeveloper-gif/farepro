package com.farepro.driver.data.local

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

enum class VehicleType(val code: String, val label: String) {
    CAR("car", "Car"),
    THONE_BANE("thone_bane", "Thone Bane"),
    ;

    companion object {
        fun fromCode(raw: String?): VehicleType =
            entries.firstOrNull { it.code.equals(raw, ignoreCase = true) } ?: CAR
    }
}

data class DriverProfile(
    val displayName: String = "",
    val plateNumber: String = "7K-0000",
    val vehicleType: VehicleType = VehicleType.CAR,
    val address: String = "",
    val photoUri: String = "",
)

@Singleton
class DriverProfileStore @Inject constructor(
    @Named("trip_ledger") private val dataStore: DataStore<Preferences>,
) {
    private val nameKey = stringPreferencesKey("profile_display_name")
    private val plateKey = stringPreferencesKey("plate_number")
    private val vehicleKey = stringPreferencesKey("profile_vehicle_type")
    private val addressKey = stringPreferencesKey("profile_address")
    private val photoKey = stringPreferencesKey("profile_photo_uri")

    val profileFlow: Flow<DriverProfile> = dataStore.data.map { prefs ->
        DriverProfile(
            displayName = prefs[nameKey].orEmpty(),
            plateNumber = prefs[plateKey] ?: "7K-0000",
            vehicleType = VehicleType.fromCode(prefs[vehicleKey]),
            address = prefs[addressKey].orEmpty(),
            photoUri = prefs[photoKey].orEmpty(),
        )
    }

    suspend fun current(): DriverProfile = profileFlow.first()

    suspend fun save(
        displayName: String? = null,
        plateNumber: String? = null,
        vehicleType: VehicleType? = null,
        address: String? = null,
        photoUri: String? = null,
    ) {
        dataStore.edit { prefs ->
            displayName?.let { prefs[nameKey] = it.trim() }
            plateNumber?.let { prefs[plateKey] = it.trim().ifBlank { "7K-0000" } }
            vehicleType?.let { prefs[vehicleKey] = it.code }
            address?.let { prefs[addressKey] = it.trim() }
            photoUri?.let {
                if (it.isBlank()) prefs.remove(photoKey) else prefs[photoKey] = it
            }
        }
    }
}
