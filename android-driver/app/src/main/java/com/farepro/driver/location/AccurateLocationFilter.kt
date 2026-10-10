package com.farepro.driver.location

import android.location.Location
import com.farepro.driver.domain.GeoMath
import kotlin.math.abs

/**
 * Ride-hailing grade GPS filter:
 * - reject low-accuracy / mock / stale samples
 * - reject teleport jumps vs realistic max speed
 * - ignore jitter under min movement
 */
class AccurateLocationFilter(
    private val maxAccuracyMeters: Float = 35f,
    private val minMoveMeters: Float = 3f,
    private val maxSpeedKmh: Double = 160.0,
    private val maxAgeMs: Long = 8_000L,
) {
    private var lastAccepted: Location? = null

    data class Result(
        val accepted: Boolean,
        val location: Location?,
        val deltaMeters: Double = 0.0,
        val reason: String? = null,
    )

    fun reset() {
        lastAccepted = null
    }

    fun evaluate(candidate: Location, nowMs: Long = System.currentTimeMillis()): Result {
        if (!candidate.hasAccuracy() || candidate.accuracy > maxAccuracyMeters) {
            return Result(false, null, reason = "low_accuracy_${candidate.accuracy}")
        }
        if (candidate.isFromMockProvider) {
            return Result(false, null, reason = "mock")
        }
        val age = nowMs - candidate.time
        if (age > maxAgeMs || age < -5_000) {
            return Result(false, null, reason = "stale_${age}")
        }

        val prev = lastAccepted
        if (prev == null) {
            lastAccepted = Location(candidate)
            return Result(true, candidate, 0.0)
        }

        val dtMs = (candidate.time - prev.time).coerceAtLeast(1L)
        val delta = GeoMath.distanceMeters(
            prev.latitude, prev.longitude,
            candidate.latitude, candidate.longitude,
        )

        if (delta < minMoveMeters) {
            // Keep fresher fix but don't count distance
            if (candidate.accuracy <= prev.accuracy) {
                lastAccepted = Location(candidate)
            }
            return Result(false, candidate, delta, reason = "jitter")
        }

        val speed = GeoMath.speedKmh(delta, dtMs)
        if (speed > maxSpeedKmh) {
            return Result(false, null, delta, reason = "teleport_${"%.0f".format(speed)}")
        }

        // Prefer better accuracy when nearly same time
        if (abs(dtMs) < 800 && candidate.accuracy > prev.accuracy + 8f) {
            return Result(false, null, delta, reason = "worse_accuracy")
        }

        lastAccepted = Location(candidate)
        return Result(true, candidate, delta)
    }
}

data class DriverFix(
    val lat: Double,
    val lng: Double,
    val accuracyM: Float,
    val speedKmh: Float,
    val bearing: Float,
    val altitudeM: Double?,
    val timestampMs: Long,
    val cumulativeDistanceM: Double,
)
