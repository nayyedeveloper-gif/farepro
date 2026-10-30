package com.farepro.driver.presentation.home

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.farepro.driver.domain.model.DemandCatalogItem
import com.farepro.driver.domain.model.DemandLine
import com.farepro.driver.domain.model.TripReceipt
import com.farepro.driver.presentation.comms.PttHoldFab
import com.farepro.driver.presentation.components.DriverMap
import com.farepro.driver.presentation.theme.Brand
import kotlinx.coroutines.delay

// Compact 8dp-grid tokens for Home only
private val Space = 8.dp
private val Screen = 16.dp
private val Radius = 8.dp
private val BrandBlue = Color(0xFF1A73E8)
private val Ink = Color(0xFF0F1C2E)
private val Muted = Color(0xFF6B7A8A)
private val Line = Color(0x14000000)
private val Surface = Color(0xFFFFFFFF)
private val Page = Color(0xFFF4F6F8)
private val MeterBg = Color(0xFF0E1620)
private val MeterOn = Color(0xFF69F0AE)
private val Danger = Color(0xFFD32F2F)

@Composable
fun HomeScreen(
    onReceipt: (TripReceipt) -> Unit,
    onOpenApps: () -> Unit,
    onOpenComms: () -> Unit = {},
    vm: HomeViewModel = hiltViewModel(),
) {
    val ui by vm.ui.collectAsState()
    val meter by vm.meterDisplay.collectAsState()
    val map by vm.mapDisplay.collectAsState()

    var follow by remember { mutableStateOf(false) }
    var confirmEnd by remember { mutableStateOf(false) }
    var showDemand by remember { mutableStateOf(false) }
    var removeConfirm by remember { mutableStateOf<DemandLine?>(null) }
    var recenterToken by remember { mutableStateOf(0) }

    LaunchedEffect(meter.running) { follow = meter.running && !meter.paused }
    LaunchedEffect(recenterToken) {
        if (recenterToken == 0) return@LaunchedEffect
        follow = true
        delay(3_500)
        if (!meter.running) follow = false
    }

    val permission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { granted ->
        val ok = granted[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            granted[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (ok) {
            follow = true
            vm.startTrip()
        }
    }

    fun requestStart() {
        permission.launch(
            buildList {
                add(Manifest.permission.ACCESS_FINE_LOCATION)
                add(Manifest.permission.ACCESS_COARSE_LOCATION)
                if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
            }.toTypedArray(),
        )
    }

    Box(Modifier.fillMaxSize().background(Page)) {
    Column(Modifier.fillMaxSize()) {
        // Header — 56dp, 16 horizontal
        Row(
            Modifier
                .fillMaxWidth()
                .height(56.dp)
                .background(Surface)
                .padding(horizontal = Screen),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    Brand.APP_NAME,
                    color = Ink,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.2).sp,
                )
                Text(
                    when {
                        meter.running && meter.paused -> "Paused"
                        meter.running -> "Trip in progress"
                        else -> "Kilo taxi meter"
                    },
                    color = Muted,
                    fontSize = 12.sp,
                )
            }
            StatusChip(
                online = ui.online,
                pending = ui.pendingSync,
            )
            IconButton(onClick = onOpenComms) {
                Icon(Icons.Default.Chat, contentDescription = "Messages", tint = Ink)
            }
            IconButton(onClick = onOpenApps) {
                Icon(Icons.Default.Settings, contentDescription = "Profile", tint = Ink)
            }
        }

        // Meter card — fixed, standard margins
        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Screen, vertical = Space)
                .clip(RoundedCornerShape(Radius))
                .background(MeterBg)
                .padding(Screen),
        ) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "%,d MMK".format(ui.walletBalance),
                    color = Color.White.copy(alpha = 0.7f),
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                )
                Text(
                    meter.plateNumber,
                    color = Color.White.copy(alpha = 0.7f),
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.SemiBold,
                )
            }

            Spacer(Modifier.height(Space))

            Text(
                "FARE",
                color = Color.White.copy(alpha = 0.45f),
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.2.sp,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
            )
            Text(
                "%,d".format(meter.fareMmk),
                color = MeterOn,
                fontSize = 44.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
                letterSpacing = (-1).sp,
                lineHeight = 48.sp,
            )
            Text(
                "MMK",
                color = MeterOn.copy(alpha = 0.75f),
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(Space + 4.dp))
            Box(Modifier.fillMaxWidth().height(1.dp).background(Color.White.copy(alpha = 0.08f)))
            Spacer(Modifier.height(Space + 4.dp))

            Row(Modifier.fillMaxWidth()) {
                MeterCell(
                    value = "%.2f".format(meter.distanceKm),
                    label = "KM",
                    modifier = Modifier.weight(1f),
                )
                MeterCell(
                    value = formatClock(meter.elapsedSec),
                    label = "TIME",
                    modifier = Modifier.weight(1f),
                )
                MeterCell(
                    value = "%,d".format(meter.baseFareMmk),
                    label = "BASE",
                    modifier = Modifier.weight(1f),
                )
                MeterCell(
                    value = if (meter.demandMmk > 0) "+%,d".format(meter.demandMmk) else "0",
                    label = "DEMAND",
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(4.dp))
                        .clickable(enabled = meter.running) { showDemand = true },
                    accent = meter.demandMmk > 0,
                )
            }

            Spacer(Modifier.height(Space))
            Text(
                if (meter.running) {
                    "Rate %,d / km · tap Demand to add/remove".format(meter.ratePerKm)
                } else {
                    "Rate %,d / km · start trip to use Demand".format(meter.ratePerKm)
                },
                color = Color.White.copy(alpha = 0.35f),
                fontSize = 11.sp,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
            )
        }

        // Map — remaining space only
        Box(
            Modifier
                .fillMaxWidth()
                .weight(1f)
                .padding(horizontal = Screen)
                .clip(RoundedCornerShape(Radius))
                .border(1.dp, Line, RoundedCornerShape(Radius))
                .background(Color(0xFFE8EEF3)),
        ) {
            DriverMap(
                modifier = Modifier.fillMaxSize(),
                center = map.center,
                markers = listOf(map.center),
                path = map.path,
                followCenter = follow && map.hasFix,
                zoom = 16.0,
                interactive = true,
                onUserMovedMap = { follow = false },
            )

            // GPS badge
            Text(
                when {
                    !map.hasFix -> "Getting GPS…"
                    else -> "±${map.accuracyM} m" + if (meter.running) " · ${map.speedKmh} km/h" else ""
                },
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = Space)
                    .clip(RoundedCornerShape(4.dp))
                    .background(Surface.copy(alpha = 0.94f))
                    .padding(horizontal = 10.dp, vertical = 4.dp),
                color = Muted,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
            )

            if (meter.running) {
                MapBtn(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(Space),
                    onClick = vm::pauseOrResume,
                ) {
                    Icon(
                        if (meter.paused) Icons.Default.PlayArrow else Icons.Default.Pause,
                        null,
                        tint = Ink,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }

            MapBtn(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(Space),
                onClick = { recenterToken += 1 },
            ) {
                Icon(Icons.Default.MyLocation, null, tint = BrandBlue, modifier = Modifier.size(20.dp))
            }
        }

        // Primary action — fixed bottom chrome
        Box(
            Modifier
                .fillMaxWidth()
                .background(Surface)
                .padding(horizontal = Screen, vertical = Space + 4.dp),
        ) {
            if (meter.running) {
                Row(horizontalArrangement = Arrangement.spacedBy(Space)) {
                    SecondaryBtn(
                        label = if (meter.paused) "Resume" else "Pause",
                        modifier = Modifier.weight(1f),
                        onClick = vm::pauseOrResume,
                    )
                    PrimaryBtn(
                        label = if (ui.ending) "Saving…" else "End trip",
                        modifier = Modifier.weight(1.3f),
                        color = Danger,
                        enabled = !ui.ending,
                        onClick = { confirmEnd = true },
                    )
                }
            } else {
                PrimaryBtn(
                    label = "Start trip",
                    modifier = Modifier.fillMaxWidth(),
                    color = BrandBlue,
                    onClick = { requestStart() },
                )
            }
        }
    }

    PttHoldFab(
        onOpenComms = onOpenComms,
        modifier = Modifier
            .align(Alignment.BottomEnd)
            .padding(end = Screen, bottom = 88.dp),
    )

    if (confirmEnd) {
        ConfirmDialog(
            fare = meter.fareMmk,
            km = meter.distanceKm,
            loading = ui.ending,
            offline = !ui.online,
            onCancel = { confirmEnd = false },
            onConfirm = {
                vm.endTrip { receipt ->
                    confirmEnd = false
                    follow = false
                    onReceipt(receipt)
                }
            },
        )
    }

    if (showDemand && meter.running) {
        DemandSheet(
            catalog = meter.demandCatalog,
            active = meter.demands.filter { it.isActive },
            usedCodes = meter.demands.map { it.code }.toSet(),
            totalMmk = meter.demandMmk,
            notice = ui.demandNotice,
            onAdd = { vm.addDemand(it) },
            onRemoveRequest = { removeConfirm = it },
            onClose = {
                showDemand = false
                vm.clearDemandNotice()
            },
        )
    }

    removeConfirm?.let { line ->
        RemoveDemandWarningDialog(
            line = line,
            onCancel = { removeConfirm = null },
            onConfirm = {
                vm.removeDemand(line.id)
                removeConfirm = null
            },
        )
    }
    } // Box
}

@Composable
private fun StatusChip(online: Boolean, pending: Int) {
    Row(
        Modifier
            .padding(end = 4.dp)
            .clip(RoundedCornerShape(4.dp))
            .background(if (online) Color(0x1A2E7D32) else Color(0x1AD32F2F))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            if (online) Icons.Default.Sync else Icons.Default.CloudOff,
            null,
            tint = if (online) Color(0xFF2E7D32) else Danger,
            modifier = Modifier.size(14.dp),
        )
        Spacer(Modifier.width(4.dp))
        Text(
            when {
                !online -> "Offline"
                pending > 0 -> "Sync $pending"
                else -> "Online"
            },
            color = if (online) Color(0xFF2E7D32) else Danger,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun MeterCell(
    value: String,
    label: String,
    modifier: Modifier = Modifier,
    accent: Boolean = false,
) {
    Column(modifier.padding(vertical = 2.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            value,
            color = if (accent) MeterOn else Color.White,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            maxLines = 1,
        )
        Text(
            label,
            color = Color.White.copy(alpha = 0.4f),
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.6.sp,
        )
    }
}

@Composable
private fun MapBtn(
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
    content: @Composable () -> Unit,
) {
    Box(
        modifier
            .size(40.dp)
            .clip(RoundedCornerShape(Radius))
            .background(Surface)
            .border(1.dp, Line, RoundedCornerShape(Radius))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
        content = { content() },
    )
}

@Composable
private fun PrimaryBtn(
    label: String,
    modifier: Modifier = Modifier,
    color: Color,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Box(
        modifier
            .height(48.dp)
            .clip(RoundedCornerShape(Radius))
            .background(if (enabled) color else color.copy(alpha = 0.45f))
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun SecondaryBtn(
    label: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Box(
        modifier
            .height(48.dp)
            .clip(RoundedCornerShape(Radius))
            .border(1.dp, Line, RoundedCornerShape(Radius))
            .background(Surface)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun ConfirmDialog(
    fare: Int,
    km: Double,
    loading: Boolean,
    offline: Boolean,
    onCancel: () -> Unit,
    onConfirm: () -> Unit,
) {
    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.4f))
            .clickable(onClick = onCancel),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier
                .padding(Screen * 1.5f)
                .clip(RoundedCornerShape(Radius))
                .background(Surface)
                .clickable(enabled = false) {}
                .padding(Screen + Space),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("End trip?", color = Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(Space))
            Text(
                "%,d MMK".format(fare),
                color = BrandBlue,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
            )
            Text("%.2f km".format(km), color = Muted, fontSize = 13.sp)
            if (offline) {
                Spacer(Modifier.height(Space))
                Text(
                    "Offline — saved on device, syncs when online",
                    color = Danger,
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center,
                )
            }
            Spacer(Modifier.height(Screen))
            Row(horizontalArrangement = Arrangement.spacedBy(Space)) {
                SecondaryBtn("Cancel", Modifier.weight(1f), onCancel)
                Box(
                    Modifier
                        .weight(1.2f)
                        .height(48.dp)
                        .clip(RoundedCornerShape(Radius))
                        .background(Danger)
                        .clickable(enabled = !loading, onClick = onConfirm),
                    contentAlignment = Alignment.Center,
                ) {
                    if (loading) {
                        CircularProgressIndicator(Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                    } else {
                        Text("Save receipt", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun DemandSheet(
    catalog: List<DemandCatalogItem>,
    active: List<DemandLine>,
    usedCodes: Set<String>,
    totalMmk: Int,
    notice: String?,
    onAdd: (DemandCatalogItem) -> Unit,
    onRemoveRequest: (DemandLine) -> Unit,
    onClose: () -> Unit,
) {
    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.45f))
            .clickable(onClick = onClose),
        contentAlignment = Alignment.BottomCenter,
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .heightIn(max = 520.dp)
                .clip(RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp))
                .background(Surface)
                .clickable(enabled = false) {}
                .padding(Screen),
        ) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text("Demand", color = Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Text(
                        if (totalMmk > 0) "Total +%,d MMK".format(totalMmk) else "No demand added",
                        color = Muted,
                        fontSize = 12.sp,
                    )
                }
                IconButton(onClick = onClose) {
                    Icon(Icons.Default.Close, contentDescription = "Close", tint = Ink)
                }
            }
            if (!notice.isNullOrBlank()) {
                Text(notice, color = Danger, fontSize = 12.sp, modifier = Modifier.padding(bottom = Space))
            }
            Text(
                "Each demand can be added once. Removing leaves a WARNING on the receipt.",
                color = Muted,
                fontSize = 11.sp,
            )
            Spacer(Modifier.height(Space))
            Column(
                Modifier
                    .weight(1f, fill = false)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(Space),
            ) {
                if (active.isNotEmpty()) {
                    Text("On this trip", color = Ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    active.forEach { line ->
                        DemandRow(
                            name = line.name,
                            amount = line.amountMmk,
                            actionIcon = Icons.Default.Remove,
                            actionTint = Danger,
                            onAction = { onRemoveRequest(line) },
                        )
                    }
                    Spacer(Modifier.height(Space))
                }
                Text("Add demand", color = Ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                catalog.forEach { item ->
                    val used = item.code in usedCodes
                    DemandRow(
                        name = item.name,
                        amount = item.amountMmk,
                        actionIcon = Icons.Default.Add,
                        actionTint = if (used) Muted else BrandBlue,
                        enabled = !used,
                        onAction = { onAdd(item) },
                    )
                }
            }
        }
    }
}

@Composable
private fun DemandRow(
    name: String,
    amount: Int,
    actionIcon: androidx.compose.ui.graphics.vector.ImageVector,
    actionTint: Color,
    enabled: Boolean = true,
    onAction: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Radius))
            .border(1.dp, Line, RoundedCornerShape(Radius))
            .background(Page)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(name, color = Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            Text("+%,d MMK".format(amount), color = Muted, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
        }
        Box(
            Modifier
                .size(36.dp)
                .clip(RoundedCornerShape(Radius))
                .background(if (enabled) actionTint.copy(alpha = 0.12f) else Color.Transparent)
                .clickable(enabled = enabled, onClick = onAction),
            contentAlignment = Alignment.Center,
        ) {
            Icon(actionIcon, null, tint = if (enabled) actionTint else Muted, modifier = Modifier.size(20.dp))
        }
    }
}

@Composable
private fun RemoveDemandWarningDialog(
    line: DemandLine,
    onCancel: () -> Unit,
    onConfirm: () -> Unit,
) {
    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.45f))
            .clickable(onClick = onCancel),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier
                .padding(Screen * 1.5f)
                .clip(RoundedCornerShape(Radius))
                .background(Surface)
                .clickable(enabled = false) {}
                .padding(Screen + Space),
        ) {
            Text("Remove demand?", color = Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(Space))
            Text(
                "WARNING! will appear on the trip receipt for ${line.name} (+%,d MMK).".format(line.amountMmk),
                color = Danger,
                fontSize = 13.sp,
            )
            Spacer(Modifier.height(Space))
            Text(
                "You cannot re-add the same demand casually after removing.",
                color = Muted,
                fontSize = 12.sp,
            )
            Spacer(Modifier.height(Screen))
            Row(horizontalArrangement = Arrangement.spacedBy(Space)) {
                SecondaryBtn("Keep", Modifier.weight(1f), onCancel)
                Box(
                    Modifier
                        .weight(1.2f)
                        .height(48.dp)
                        .clip(RoundedCornerShape(Radius))
                        .background(Danger)
                        .clickable(onClick = onConfirm),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("Remove + warn", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }
            }
        }
    }
}

private fun formatClock(sec: Int): String {
    val m = sec / 60
    val s = sec % 60
    return "%02d:%02d".format(m, s)
}
