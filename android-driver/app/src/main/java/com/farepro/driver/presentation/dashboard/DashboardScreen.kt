package com.farepro.driver.presentation.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.farepro.driver.domain.model.DashboardStats
import com.farepro.driver.domain.model.TripReceipt
import com.farepro.driver.presentation.components.DriverMap
import com.farepro.driver.presentation.theme.FpTheme
import com.farepro.driver.presentation.trips.FareProTopBar
import com.farepro.driver.presentation.trips.formatMins
import com.farepro.driver.presentation.trips.formatStamp
import com.farepro.driver.presentation.trips.tripRoutePoints

@Composable
fun DashboardScreen(
    onOpenMenu: () -> Unit,
    onOpenTrip: (String) -> Unit = {},
    vm: DashboardViewModel = hiltViewModel(),
) {
    val ui by vm.ui.collectAsState()
    val c = FpTheme.colors

    Column(Modifier.fillMaxSize().background(c.bg)) {
        FareProTopBar(
            title = "Dashboard",
            subtitle = "${ui.orgName} · month ${ui.month.totalTrips} trips",
            onSettings = onOpenMenu,
        )

        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Today", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = c.text)
            StatsGrid(ui.today)

            Text("This month", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = c.text)
            StatsGrid(ui.month)

            if (ui.recent.isNotEmpty()) {
                Text(
                    "Recent trips",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = c.text,
                )
                ui.recent.forEach { trip ->
                    RecentTripRow(trip = trip, onClick = { onOpenTrip(trip.id) })
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun StatsGrid(stats: DashboardStats) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            StatCard("Trips", "%,d".format(stats.totalTrips), Modifier.weight(1f))
            StatCard("Earnings", "%,d".format(stats.totalAmountMmk), Modifier.weight(1f), unit = "MMK")
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            StatCard("Distance", "%.2f".format(stats.distanceKm), Modifier.weight(1f), unit = "km")
            StatCard("Duration", formatDurationLong(stats.durationSec), Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            StatCard("Demand", "%,d".format(stats.demandMmk), Modifier.weight(1f), unit = "MMK")
            StatCard("Avg fare", "%,d".format(stats.avgFareMmk), Modifier.weight(1f), unit = "MMK")
        }
    }
}

@Composable
private fun StatCard(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    unit: String? = null,
) {
    val c = FpTheme.colors
    val shape = RoundedCornerShape(12.dp)
    Column(
        modifier = modifier
            .clip(shape)
            .background(Color.White)
            .border(1.dp, c.border, shape)
            .padding(horizontal = 14.dp, vertical = 14.dp),
    ) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = c.textMuted)
        Spacer(Modifier.height(4.dp))
        Text(
            value,
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            color = c.text,
            maxLines = 1,
        )
        if (unit != null) {
            Text(unit, style = MaterialTheme.typography.labelSmall, color = c.textFaint)
        }
    }
}

@Composable
private fun RecentTripRow(trip: TripReceipt, onClick: () -> Unit) {
    val c = FpTheme.colors
    val shape = RoundedCornerShape(12.dp)
    val route = remember(trip.id) { tripRoutePoints(trip) }

    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Color.White)
            .border(1.dp, c.border, shape)
            .clickable(onClick = onClick),
    ) {
        if (route.size >= 2) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(100.dp),
            ) {
                DriverMap(
                    center = route.last(),
                    path = route,
                    markers = listOf(route.first().copy(title = "A"), route.last().copy(title = "B")),
                    followCenter = false,
                    fitPath = true,
                    interactive = false,
                    zoom = 13.5,
                )
            }
        }
        Row(
            Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(formatStamp(trip.endedAtMs), style = MaterialTheme.typography.labelSmall, color = c.textMuted)
                Text(
                    "%,d MMK".format(trip.fareMmk),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = c.text,
                )
                Text(
                    "%.2f km · ${formatMins(trip.durationSec)}".format(trip.distanceKm) +
                        if (trip.effectiveDemandMmk > 0) " · +%,d demand".format(trip.effectiveDemandMmk) else "",
                    style = MaterialTheme.typography.bodySmall,
                    color = c.textSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Icon(Icons.Default.ChevronRight, null, tint = c.textFaint, modifier = Modifier.size(20.dp))
        }
    }
}

private fun formatDurationLong(sec: Int): String {
    val h = sec / 3600
    val m = (sec % 3600) / 60
    return if (h > 0) "%dh %dm".format(h, m) else "%dm".format(m)
}
