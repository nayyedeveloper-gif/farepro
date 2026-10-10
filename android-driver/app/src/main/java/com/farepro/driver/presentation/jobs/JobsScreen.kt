package com.farepro.driver.presentation.jobs

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.farepro.driver.domain.model.TripJob
import com.farepro.driver.presentation.components.DriverMap
import com.farepro.driver.presentation.components.FpCard
import com.farepro.driver.presentation.components.FpInlineError
import com.farepro.driver.presentation.components.FpPrimaryButton
import com.farepro.driver.presentation.components.FpSecondaryButton
import com.farepro.driver.presentation.components.FpStatusChip
import com.farepro.driver.presentation.components.FpVGap
import com.farepro.driver.presentation.components.MapPoint
import com.farepro.driver.presentation.theme.FpColors
import com.farepro.driver.presentation.theme.FpTheme

@Composable
fun JobsScreen(
    onOpenMeter: (String) -> Unit,
    vm: JobsViewModel = hiltViewModel(),
) {
    val ui by vm.ui.collectAsState()
    val fix by vm.fix.collectAsState()
    val path by vm.path.collectAsState()
    val colors = FpTheme.colors
    val spacing = FpTheme.spacing
    var follow by remember { mutableStateOf(true) }

    val permission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { granted ->
        val ok = granted[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            granted[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (ok) vm.setOnline(true)
    }

    val center = if (fix.timestampMs > 0) {
        MapPoint(fix.lat, fix.lng, "You")
    } else {
        MapPoint(16.8661, 96.1951)
    }
    val active = ui.trips.firstOrNull()
    val markers = buildList {
        add(center)
        val pLat = active?.pickupLat
        val pLng = active?.pickupLng
        if (pLat != null && pLng != null) add(MapPoint(pLat, pLng, "Pickup"))
        val dLat = active?.dropoffLat
        val dLng = active?.dropoffLng
        if (dLat != null && dLng != null) add(MapPoint(dLat, dLng, "Dropoff"))
    }

    Box(Modifier.fillMaxSize().background(colors.bg)) {
        DriverMap(
            modifier = Modifier.fillMaxSize(),
            center = center,
            markers = markers,
            path = path.map { MapPoint(it.first, it.second) },
            followCenter = follow && ui.online,
            zoom = 16.0,
        )

        // Top status bar
        Row(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .fillMaxWidth()
                .padding(spacing.screen)
                .shadow(8.dp, RoundedCornerShape(FpTheme.radius.lg))
                .clip(RoundedCornerShape(FpTheme.radius.lg))
                .background(colors.surface.copy(alpha = 0.96f))
                .padding(horizontal = spacing.md, vertical = spacing.sm),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    ui.orgName ?: "FarePro Driver",
                    style = MaterialTheme.typography.titleMedium,
                    color = colors.text,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    if (ui.online) {
                        if (fix.timestampMs > 0) {
                            "Online · GPS ±%.0fm · %.0f km/h".format(fix.accuracyM, fix.speedKmh)
                        } else {
                            "Online · acquiring GPS…"
                        }
                    } else {
                        "Offline · go online to receive jobs"
                    },
                    style = MaterialTheme.typography.labelSmall,
                    color = if (ui.online) colors.success else colors.textMuted,
                )
            }
            Switch(
                checked = ui.online,
                onCheckedChange = { on ->
                    if (on) {
                        val perms = buildList {
                            add(Manifest.permission.ACCESS_FINE_LOCATION)
                            add(Manifest.permission.ACCESS_COARSE_LOCATION)
                            if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
                        }.toTypedArray()
                        permission.launch(perms)
                    } else {
                        vm.setOnline(false)
                    }
                },
                colors = SwitchDefaults.colors(
                    checkedTrackColor = colors.success,
                    checkedThumbColor = Color.White,
                ),
            )
        }

        IconButton(
            onClick = { follow = true },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = spacing.screen, bottom = 280.dp)
                .size(48.dp)
                .shadow(6.dp, CircleShape)
                .clip(CircleShape)
                .background(colors.surface),
        ) {
            Icon(Icons.Default.MyLocation, contentDescription = "Recenter", tint = colors.brand)
        }

        // Bottom sheet panel
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .heightIn(min = 200.dp, max = 420.dp)
                .shadow(16.dp, RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                .clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                .background(colors.bgElevated)
                .padding(spacing.screen)
                .verticalScroll(rememberScrollState()),
        ) {
            Box(
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .padding(bottom = spacing.sm)
                    .size(width = 40.dp, height = 4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(colors.borderStrong),
            )
            FpInlineError(ui.error)

            when {
                ui.loading -> {
                    Box(Modifier.fillMaxWidth().height(120.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = colors.brand)
                    }
                }
                !ui.online -> {
                    Text("You're offline", style = MaterialTheme.typography.titleLarge, color = colors.text)
                    Text(
                        "Turn online to share live location with dispatch and receive kilo jobs.",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textMuted,
                    )
                }
                ui.trips.isEmpty() -> {
                    Text("Looking for rides", style = MaterialTheme.typography.titleLarge, color = colors.text)
                    Text(
                        "Stay in your zone. New offers appear here with map + fare estimate.",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textMuted,
                    )
                    FpVGap(spacing.sm)
                    FpSecondaryButton("Refresh jobs", onClick = vm::refresh)
                }
                else -> {
                    ui.trips.forEach { trip ->
                        TripSheetCard(
                            trip = trip,
                            busy = ui.busyId == trip.id,
                            colors = colors,
                            onAccept = { vm.accept(trip.id) },
                            onReject = { vm.reject(trip.id) },
                            onAdvance = { vm.advance(trip.id, it) },
                            onCancel = { vm.cancel(trip.id) },
                            onMeter = { onOpenMeter(trip.id) },
                        )
                        Spacer(Modifier.height(spacing.sm))
                    }
                }
            }
        }
    }
}

@Composable
private fun TripSheetCard(
    trip: TripJob,
    busy: Boolean,
    colors: FpColors,
    onAccept: () -> Unit,
    onReject: () -> Unit,
    onAdvance: (String) -> Unit,
    onCancel: () -> Unit,
    onMeter: () -> Unit,
) {
    val statusColor = when (trip.status) {
        "assigned" -> colors.warning
        "en_route" -> colors.info
        "arrived" -> colors.success
        else -> colors.textMuted
    }

    FpCard {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(trip.customerName, style = MaterialTheme.typography.titleLarge, color = colors.text)
                Text(
                    if (trip.bookingSource == "customer") "Customer app" else "Stand dispatch",
                    style = MaterialTheme.typography.labelSmall,
                    color = colors.textMuted,
                )
            }
            FpStatusChip(trip.status.replace('_', ' '), statusColor)
        }
        Text("PICKUP", style = MaterialTheme.typography.labelSmall, color = colors.success)
        Text(trip.pickupAddress, style = MaterialTheme.typography.bodyMedium, color = colors.text)
        Text("DROPOFF", style = MaterialTheme.typography.labelSmall, color = colors.brand)
        Text(trip.dropoffAddress, style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary)
        trip.estimatedFare?.let { fare ->
            Text(
                "%,d MMK".format(fare) + (trip.distanceKm?.let { " · %.1f km".format(it) } ?: ""),
                style = MaterialTheme.typography.headlineMedium,
                color = colors.brand,
            )
        }
        when (trip.status) {
            "assigned" -> Row(horizontalArrangement = Arrangement.spacedBy(FpTheme.spacing.sm)) {
                FpPrimaryButton("Accept", onAccept, Modifier.weight(1f), busy, color = colors.success)
                FpSecondaryButton("Decline", onReject, Modifier.weight(1f), !busy)
            }
            "en_route" -> {
                FpPrimaryButton("Arrived", { onAdvance("arrived") }, loading = busy, color = colors.success)
                Row(horizontalArrangement = Arrangement.spacedBy(FpTheme.spacing.sm)) {
                    FpSecondaryButton("Fare meter", onMeter, Modifier.weight(1f))
                    FpSecondaryButton("Cancel", onCancel, Modifier.weight(1f), !busy)
                }
            }
            "arrived" -> {
                FpPrimaryButton("Complete", { onAdvance("completed") }, loading = busy, color = colors.success)
                Row(horizontalArrangement = Arrangement.spacedBy(FpTheme.spacing.sm)) {
                    FpSecondaryButton("Fare meter", onMeter, Modifier.weight(1f))
                    FpSecondaryButton("Cancel", onCancel, Modifier.weight(1f), !busy)
                }
            }
        }
    }
}
