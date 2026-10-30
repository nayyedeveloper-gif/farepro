package com.farepro.driver.domain.model

import kotlinx.serialization.Serializable
import java.util.UUID

/** Catalog entry configured by stand (or built-in defaults). */
@Serializable
data class DemandCatalogItem(
    val code: String,
    val name: String,
    val amountMmk: Int,
)

/** Applied (or removed-with-warning) demand on an active / completed trip. */
@Serializable
data class DemandLine(
    val id: String = UUID.randomUUID().toString(),
    val code: String,
    val name: String,
    val amountMmk: Int,
    val addedAtMs: Long = System.currentTimeMillis(),
    val removedAtMs: Long? = null,
    /** True when driver removed after adding — shown as WARNING on receipt. */
    val removalWarning: Boolean = false,
) {
    val isActive: Boolean get() = removedAtMs == null
}

object DemandCatalog {
    val DEFAULT: List<DemandCatalogItem> = listOf(
        DemandCatalogItem("airport", "Airport", 2000),
        DemandCatalogItem("waiting", "Waiting", 500),
        DemandCatalogItem("luggage", "Luggage", 1000),
        DemandCatalogItem("peak", "Peak demand", 1000),
        DemandCatalogItem("night_extra", "Night demand", 1500),
        DemandCatalogItem("toll", "Toll / bridge", 500),
    )

    fun activeTotal(lines: List<DemandLine>): Int =
        lines.filter { it.isActive }.sumOf { it.amountMmk }

    fun warnings(lines: List<DemandLine>): List<DemandLine> =
        lines.filter { it.removalWarning }
}
