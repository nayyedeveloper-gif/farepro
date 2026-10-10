package com.farepro.driver.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class TripDto(
    val id: String,
    @SerialName("customerName") val customerName: String = "",
    @SerialName("pickupAddress") val pickupAddress: String = "",
    @SerialName("dropoffAddress") val dropoffAddress: String = "",
    val status: String = "",
    @SerialName("driverId") val driverId: String? = null,
    @SerialName("customerPhone") val customerPhone: String? = null,
    @SerialName("distanceKm") val distanceKm: Double? = null,
    @SerialName("estimatedFare") val estimatedFare: Int? = null,
    @SerialName("actualFare") val actualFare: Int? = null,
    @SerialName("pickupLat") val pickupLat: Double? = null,
    @SerialName("pickupLng") val pickupLng: Double? = null,
    @SerialName("dropoffLat") val dropoffLat: Double? = null,
    @SerialName("dropoffLng") val dropoffLng: Double? = null,
    @SerialName("driverLat") val driverLat: Double? = null,
    @SerialName("driverLng") val driverLng: Double? = null,
    @SerialName("paymentMethod") val paymentMethod: String? = null,
    @SerialName("bookingSource") val bookingSource: String? = null,
    @SerialName("serviceType") val serviceType: String? = null,
    @SerialName("vehicleType") val vehicleType: String? = null,
    @SerialName("parcelNotes") val parcelNotes: String? = null,
    @SerialName("offerExpiresAt") val offerExpiresAt: String? = null,
)

@Serializable
data class UpdateTripRequest(
    val status: String? = null,
    @SerialName("actualFare") val actualFare: Int? = null,
    @SerialName("distanceKm") val distanceKm: Double? = null,
)

@Serializable
data class TripLocationRequest(
    val lat: Double,
    val lng: Double,
)

@Serializable
data class WalletDto(
    @SerialName("balanceMmk") val balanceMmk: Int = 0,
    @SerialName("updatedAt") val updatedAt: String? = null,
)

@Serializable
data class MyWalletResponse(
    val wallet: WalletDto = WalletDto(),
    @SerialName("commissionRate") val commissionRate: Double? = null,
    @SerialName("commissionMin") val commissionMin: Int? = null,
    @SerialName("creditFloorMmk") val creditFloorMmk: Int? = null,
    @SerialName("paymentInfo") val paymentInfo: String? = null,
    @SerialName("canReceiveJobs") val canReceiveJobs: Boolean = true,
)
