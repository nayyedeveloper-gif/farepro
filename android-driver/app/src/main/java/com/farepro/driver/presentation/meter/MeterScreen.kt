package com.farepro.driver.presentation.meter

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.farepro.driver.presentation.components.DriverMap
import com.farepro.driver.presentation.components.FpInlineError
import com.farepro.driver.presentation.components.FpPrimaryButton
import com.farepro.driver.presentation.components.FpSecondaryButton
import com.farepro.driver.presentation.components.FpStatTile
import com.farepro.driver.presentation.components.FpVGap
import com.farepro.driver.presentation.components.MapPoint
import com.farepro.driver.presentation.theme.FpTheme

@Composable
fun MeterScreen(
    tripId: String?,
    vm: MeterViewModel = hiltViewModel(),
) {
    val ui by vm.ui.collectAsState()
    val live by vm.liveFix.collectAsState()
    val s = FpTheme.spacing
    val c = FpTheme.colors
    var follow by remember { mutableStateOf(true) }

    LaunchedEffect(tripId) { vm.bindTrip(tripId) }

    val permission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { granted ->
        val ok = granted[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            granted[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (ok) vm.start()
    }

    val lat = ui.lat ?: live.lat.takeIf { live.timestampMs > 0 } ?: 16.8661
    val lng = ui.lng ?: live.lng.takeIf { live.timestampMs > 0 } ?: 96.1951
    val center = MapPoint(lat, lng, "You")
    val path = ui.path.map { MapPoint(it.first, it.second) }

    Box(Modifier.fillMaxSize().background(c.bg)) {
        DriverMap(
            modifier = Modifier.fillMaxSize(),
            center = center,
            markers = listOf(center),
            path = path,
            followCenter = follow && ui.running && !ui.paused,
            zoom = 17.0,
        )

        // Status pill
        Row(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(s.screen)
                .shadow(8.dp, RoundedCornerShape(FpTheme.radius.full))
                .clip(RoundedCornerShape(FpTheme.radius.full))
                .background(c.surface.copy(alpha = 0.96f))
                .padding(horizontal = s.md, vertical = s.sm),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(s.sm),
        ) {
            Box(
                Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(
                        when {
                            ui.running && !ui.paused -> c.success
                            ui.paused -> c.warning
                            else -> c.textMuted
                        },
                    ),
            )
            Text(
                when {
                    ui.running && ui.paused -> "PAUSED"
                    ui.running -> "METERING"
                    else -> "READY"
                },
                style = MaterialTheme.typography.labelLarge,
                color = c.text,
                fontWeight = FontWeight.Bold,
            )
            Text("·", color = c.textFaint)
            Text(
                if (live.timestampMs > 0) "GPS ±%.0fm".format(ui.accuracyM.takeIf { it > 0 } ?: live.accuracyM)
                else "Waiting GPS",
                style = MaterialTheme.typography.labelSmall,
                color = c.textMuted,
            )
        }

        // Speed badge
        Column(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(top = 72.dp, end = s.screen)
                .shadow(6.dp, RoundedCornerShape(FpTheme.radius.lg))
                .clip(RoundedCornerShape(FpTheme.radius.lg))
                .background(c.mapScrim)
                .padding(horizontal = s.md, vertical = s.sm),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                "${ui.speedKmh.takeIf { ui.running } ?: live.speedKmh.toInt()}",
                style = MaterialTheme.typography.headlineMedium,
                color = c.text,
            )
            Text("KM/H", style = MaterialTheme.typography.labelSmall, color = c.textMuted)
        }

        IconButton(
            onClick = { follow = true },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = s.screen, bottom = 300.dp)
                .size(48.dp)
                .shadow(6.dp, CircleShape)
                .clip(CircleShape)
                .background(c.surface),
        ) {
            Icon(Icons.Default.MyLocation, contentDescription = "Recenter", tint = c.brand)
        }

        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .heightIn(min = 240.dp)
                .shadow(16.dp, RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                .clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                .background(c.bgElevated)
                .padding(s.screen),
        ) {
            Box(
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .padding(bottom = s.sm)
                    .size(width = 40.dp, height = 4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(c.borderStrong),
            )

            Text(
                if (tripId != null) "Trip fare meter" else "Standalone GPS meter",
                style = MaterialTheme.typography.labelMedium,
                color = c.textMuted,
            )
            Text(
                "%,d".format(ui.fareMmk),
                style = MaterialTheme.typography.displayLarge,
                color = c.brand,
            )
            Text("MMK", style = MaterialTheme.typography.titleMedium, color = c.textSecondary)

            FpVGap(s.sm)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(s.sm),
            ) {
                FpStatTile("%.2f".format(ui.distanceKm), "km", Modifier.weight(1f))
                FpStatTile(formatDuration(ui.elapsedSec), "time", Modifier.weight(1f))
                FpStatTile("${ui.rates.ratePerKm}", "mmk/km", Modifier.weight(1f), accent = c.brand)
            }

            Text(
                "Min %,d · night ×%.1f · filtered GPS haversine".format(
                    ui.rates.minimumFare,
                    ui.rates.nightMultiplier,
                ),
                style = MaterialTheme.typography.labelSmall,
                color = c.textFaint,
                modifier = Modifier.padding(top = s.xs),
            )

            FpInlineError(ui.error)
            ui.message?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = c.success)
            }

            FpVGap(s.md)
            if (!ui.running) {
                FpPrimaryButton(
                    label = "Start meter",
                    color = c.success,
                    onClick = {
                        val perms = buildList {
                            add(Manifest.permission.ACCESS_FINE_LOCATION)
                            add(Manifest.permission.ACCESS_COARSE_LOCATION)
                            if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
                        }.toTypedArray()
                        permission.launch(perms)
                    },
                )
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(s.sm)) {
                    if (ui.paused) {
                        FpPrimaryButton("Resume", vm::resume, Modifier.weight(1f), color = c.success)
                    } else {
                        FpSecondaryButton("Pause", vm::pause, Modifier.weight(1f))
                    }
                    FpPrimaryButton(
                        label = if (tripId != null) "Finish trip" else "Stop",
                        onClick = vm::finishTrip,
                        modifier = Modifier.weight(1f),
                        loading = ui.saving,
                    )
                }
            }
        }
    }
}

private fun formatDuration(sec: Int): String {
    val m = sec / 60
    val s = sec % 60
    return "%02d:%02d".format(m, s)
}
