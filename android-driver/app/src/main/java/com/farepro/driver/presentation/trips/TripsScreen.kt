package com.farepro.driver.presentation.trips

import androidx.compose.foundation.Image
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Route
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Straighten
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.farepro.driver.R
import com.farepro.driver.domain.model.TripReceipt
import com.farepro.driver.presentation.components.DriverMap
import com.farepro.driver.presentation.components.MapPoint
import com.farepro.driver.presentation.theme.Brand
import com.farepro.driver.presentation.theme.FpTheme
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun TripsScreen(
    onOpenReceipt: (String) -> Unit,
    onOpenMenu: () -> Unit,
    vm: TripsViewModel = hiltViewModel(),
) {
    val trips by vm.trips.collectAsState()
    val orgName by vm.orgName.collectAsState()
    val c = FpTheme.colors

    Column(Modifier.fillMaxSize().background(c.bg)) {
        FareProTopBar(
            title = "Trips",
            subtitle = "$orgName · ${trips.size} saved",
            onSettings = onOpenMenu,
        )

        if (trips.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.Route, null, tint = c.textFaint, modifier = Modifier.size(48.dp))
                    Spacer(Modifier.height(12.dp))
                    Text("No trips yet", style = MaterialTheme.typography.titleMedium, color = c.text)
                    Text(
                        "Complete a trip on Home to see route + receipt here.",
                        color = c.textMuted,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(horizontal = 14.dp, vertical = 10.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(trips, key = { it.id }) { trip ->
                    TripHistoryCard(trip = trip, onClick = { onOpenReceipt(trip.id) })
                }
                item { Spacer(Modifier.height(20.dp)) }
            }
        }
    }
}

@Composable
fun TripHistoryCard(trip: TripReceipt, onClick: () -> Unit) {
    val c = FpTheme.colors
    val shape = RoundedCornerShape(14.dp)
    val route = remember(trip.id, trip.path, trip.startLat, trip.endLat) { tripRoutePoints(trip) }

    Column(
        modifier = Modifier
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
                    .height(132.dp)
                    .clip(RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp)),
            ) {
                DriverMap(
                    center = route.last(),
                    path = route,
                    markers = listOf(
                        route.first().copy(title = "Start"),
                        route.last().copy(title = "End"),
                    ),
                    followCenter = false,
                    fitPath = true,
                    interactive = false,
                    zoom = 14.0,
                )
                Text(
                    "Start → End route",
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(8.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(Color.White.copy(alpha = 0.92f))
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                    style = MaterialTheme.typography.labelSmall,
                    color = c.text,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }

        Row(
            Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (route.size < 2) {
                Box(
                    Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(c.brandSoft),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Default.Route, null, tint = c.brand)
                }
                Spacer(Modifier.width(12.dp))
            }
            Column(Modifier.weight(1f)) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        formatStamp(trip.endedAtMs),
                        style = MaterialTheme.typography.labelMedium,
                        color = c.textMuted,
                    )
                    SyncChip(trip.syncStatus)
                }
                Spacer(Modifier.height(2.dp))
                Text(
                    "%,d MMK".format(trip.fareMmk),
                    style = MaterialTheme.typography.titleLarge,
                    color = c.text,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                )
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    MetaChip(Icons.Default.Straighten, "%.2f km".format(trip.distanceKm))
                    MetaChip(Icons.Default.AccessTime, formatMins(trip.durationSec))
                    if (trip.effectiveDemandMmk > 0) {
                        Text(
                            "+%,d dem".format(trip.effectiveDemandMmk),
                            style = MaterialTheme.typography.bodySmall,
                            color = c.brand,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                    if (trip.demandWarnings.isNotEmpty()) {
                        Text(
                            "WARNING!",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFFD32F2F),
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    "A  ${trip.startAddress}",
                    style = MaterialTheme.typography.labelSmall,
                    color = c.textSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    "B  ${trip.endAddress}",
                    style = MaterialTheme.typography.labelSmall,
                    color = c.textSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Icon(Icons.Default.ChevronRight, null, tint = c.textFaint)
        }
    }
}

@Composable
private fun MetaChip(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String) {
    val c = FpTheme.colors
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = c.textMuted, modifier = Modifier.size(14.dp))
        Spacer(Modifier.width(4.dp))
        Text(text, style = MaterialTheme.typography.bodySmall, color = c.textSecondary)
    }
}

@Composable
private fun SyncChip(status: String) {
    val c = FpTheme.colors
    val (label, icon, color) = when (status) {
        TripReceipt.SYNC_SYNCED -> Triple("Synced", Icons.Default.CloudDone, c.success)
        TripReceipt.SYNC_PENDING -> Triple("Pending", Icons.Default.CloudUpload, c.warning)
        else -> Triple("Local", Icons.Default.CloudOff, c.textMuted)
    }
    Row(
        Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(color.copy(alpha = 0.12f))
            .padding(horizontal = 6.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = color, modifier = Modifier.size(12.dp))
        Spacer(Modifier.width(4.dp))
        Text(label, style = MaterialTheme.typography.labelSmall, color = color, fontWeight = FontWeight.SemiBold)
    }
}

fun tripRoutePoints(trip: TripReceipt): List<MapPoint> {
    if (trip.path.size >= 2) {
        return trip.path.map { MapPoint(it.lat, it.lng) }
    }
    val startLat = trip.startLat
    val startLng = trip.startLng
    val endLat = trip.endLat
    val endLng = trip.endLng
    if (startLat != null && startLng != null && endLat != null && endLng != null) {
        return listOf(MapPoint(startLat, startLng, "Start"), MapPoint(endLat, endLng, "End"))
    }
    if (trip.path.size == 1) {
        val p = trip.path.first()
        return listOf(MapPoint(p.lat, p.lng))
    }
    return emptyList()
}

@Composable
fun FareProTopBar(title: String, subtitle: String, onSettings: () -> Unit) {
    val c = FpTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .background(c.brand)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Image(
            painter = painterResource(R.drawable.farepro_logo),
            contentDescription = Brand.APP_NAME,
            modifier = Modifier.size(36.dp).clip(RoundedCornerShape(9.dp)),
            contentScale = ContentScale.Crop,
        )
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = Color.White, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(subtitle, color = c.accent, style = MaterialTheme.typography.labelSmall)
        }
        IconButton(onClick = onSettings) {
            Icon(Icons.Default.Settings, null, tint = Color.White)
        }
    }
}

fun formatStamp(ms: Long): String =
    SimpleDateFormat("dd MMM yyyy · hh:mm a", Locale.US).format(Date(ms))

fun formatMins(sec: Int): String {
    val h = sec / 3600
    val m = (sec % 3600) / 60
    return when {
        h > 0 -> "%dh %dm".format(h, m)
        else -> "%d min".format(m.coerceAtLeast(0))
    }
}
