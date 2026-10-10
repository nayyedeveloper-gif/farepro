package com.farepro.driver.domain

import com.farepro.driver.domain.model.FareRates
import java.util.Calendar
import kotlin.math.roundToInt

/** Mirrors Go backend services.CalculateFare for offline GPS meter. */
object FareCalculator {
    fun haversineKm(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double =
        GeoMath.distanceKm(lat1, lng1, lat2, lng2)

    fun calculate(distanceKm: Double, rates: FareRates, nowMillis: Long = System.currentTimeMillis()): Int {
        val rate = if (rates.ratePerKm > 0) rates.ratePerKm else 1500
        val minFare = if (rates.minimumFare > 0) rates.minimumFare else 2000
        if (distanceKm <= 0) return minFare

        val hour = Calendar.getInstance().apply { timeInMillis = nowMillis }.get(Calendar.HOUR_OF_DAY)
        var multiplier = 1.0
        if (isNight(hour, rates.nightStartHour, rates.nightEndHour) && rates.nightMultiplier > 1) {
            multiplier = rates.nightMultiplier
        }
        val fare = (distanceKm * rate * multiplier).roundToInt()
        return if (fare < minFare) minFare else fare
    }

    private fun isNight(hour: Int, start: Int, end: Int): Boolean {
        if (start == end) return false
        return if (start < end) hour in start until end else hour >= start || hour < end
    }
}
