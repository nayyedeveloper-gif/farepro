package com.farepro.driver.domain

import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/** WGS84 geodesic helpers for ride-hailing distance/speed. */
object GeoMath {
    private const val EARTH_RADIUS_M = 6_371_008.8 // mean Earth radius (meters)

    /** Great-circle distance in meters (haversine). */
    fun distanceMeters(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
        val dLat = Math.toRadians(lat2 - lat1)
        val dLng = Math.toRadians(lng2 - lng1)
        val a = sin(dLat / 2) * sin(dLat / 2) +
            cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
            sin(dLng / 2) * sin(dLng / 2)
        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return EARTH_RADIUS_M * c
    }

    fun distanceKm(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double =
        distanceMeters(lat1, lng1, lat2, lng2) / 1000.0

    /** Initial bearing degrees [0, 360). */
    fun bearingDegrees(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Float {
        val φ1 = Math.toRadians(lat1)
        val φ2 = Math.toRadians(lat2)
        val Δλ = Math.toRadians(lng2 - lng1)
        val y = sin(Δλ) * cos(φ2)
        val x = cos(φ1) * sin(φ2) - sin(φ1) * cos(φ2) * cos(Δλ)
        val θ = Math.toDegrees(atan2(y, x))
        return ((θ + 360.0) % 360.0).toFloat()
    }

    fun speedKmh(distanceMeters: Double, elapsedMs: Long): Double {
        if (elapsedMs <= 0) return 0.0
        return (distanceMeters / (elapsedMs / 1000.0)) * 3.6
    }
}
