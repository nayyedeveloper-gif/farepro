package com.farepro.driver.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class TripReceipt(
    val id: String,
    val serverTripId: String? = null,
    val startedAtMs: Long,
    val endedAtMs: Long,
    val durationSec: Int,
    val distanceKm: Double,
    val fareMmk: Int,
    val baseFareMmk: Int,
    /** Active demand total (legacy field name kept for older ledger rows). */
    val extrasMmk: Int = 0,
    val demandMmk: Int = 0,
    val demands: List<DemandLine> = emptyList(),
    val ratePerKm: Int,
    val startLat: Double? = null,
    val startLng: Double? = null,
    val endLat: Double? = null,
    val endLng: Double? = null,
    val startAddress: String = "Trip start",
    val endAddress: String = "Trip end",
    val path: List<PathPoint> = emptyList(),
    val plateNumber: String = "",
    val driverName: String = "",
    val orgName: String = "",
    /** local = offline-only · pending = needs API sync · synced = pushed */
    val syncStatus: String = SYNC_LOCAL,
) {
    val effectiveDemandMmk: Int
        get() = if (demandMmk > 0) demandMmk else extrasMmk

    val demandWarnings: List<DemandLine>
        get() = DemandCatalog.warnings(demands)

    companion object {
        const val SYNC_LOCAL = "local"
        const val SYNC_PENDING = "pending"
        const val SYNC_SYNCED = "synced"
    }
}

@Serializable
data class PathPoint(val lat: Double, val lng: Double)

data class DashboardStats(
    val totalTrips: Int = 0,
    val distanceKm: Double = 0.0,
    val durationSec: Int = 0,
    val totalAmountMmk: Int = 0,
    val demandMmk: Int = 0,
    val avgFareMmk: Int = 0,
)
