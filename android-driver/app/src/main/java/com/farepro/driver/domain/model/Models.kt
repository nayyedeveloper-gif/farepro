package com.farepro.driver.domain.model

data class DriverUser(
    val id: String,
    val displayName: String,
    val phone: String?,
)

data class TripJob(
    val id: String,
    val customerName: String,
    val pickupAddress: String,
    val dropoffAddress: String,
    val status: String,
    val driverId: String?,
    val customerPhone: String?,
    val distanceKm: Double?,
    val estimatedFare: Int?,
    val actualFare: Int?,
    val pickupLat: Double?,
    val pickupLng: Double?,
    val dropoffLat: Double?,
    val dropoffLng: Double?,
    val driverLat: Double? = null,
    val driverLng: Double? = null,
    val bookingSource: String?,
    val offerExpiresAt: String?,
)

data class FareRates(
    val ratePerKm: Int = 1500,
    val minimumFare: Int = 2000,
    val nightMultiplier: Double = 1.2,
    val nightStartHour: Int = 22,
    val nightEndHour: Int = 5,
)

data class WalletSummary(
    val balanceMmk: Int,
    val canReceiveJobs: Boolean,
    val paymentInfo: String?,
)

sealed class AppResult<out T> {
    data class Ok<T>(val value: T) : AppResult<T>()
    data class Err(val message: String) : AppResult<Nothing>()
}
