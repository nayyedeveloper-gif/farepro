package com.farepro.driver.presentation.receipt

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.farepro.driver.domain.model.TripReceipt
import com.farepro.driver.presentation.components.DriverMap
import com.farepro.driver.presentation.components.FpPrimaryButton
import com.farepro.driver.presentation.components.MapPoint
import com.farepro.driver.presentation.theme.Brand
import com.farepro.driver.presentation.theme.FpTheme
import com.farepro.driver.presentation.trips.formatMins
import com.farepro.driver.presentation.trips.formatStamp

@Composable
fun ReceiptScreen(
    receiptId: String,
    onBack: () -> Unit,
    vm: ReceiptViewModel = hiltViewModel(),
) {
    var receipt by remember { mutableStateOf<TripReceipt?>(null) }
    val c = FpTheme.colors
    val context = LocalContext.current

    LaunchedEffect(receiptId) {
        receipt = vm.load(receiptId)
    }

    val r = receipt
    Column(Modifier.fillMaxSize().background(c.bg)) {
        Row(
            Modifier
                .fillMaxWidth()
                .background(c.brand)
                .padding(horizontal = 4.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Color.White)
            }
            Text(
                "Trip Receipt",
                modifier = Modifier.weight(1f),
                color = Color.White,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
            if (r != null) {
                IconButton(onClick = {
                    val text = buildShareText(r)
                    context.startActivity(
                        Intent.createChooser(
                            Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_TEXT, text)
                            },
                            "Share receipt",
                        ),
                    )
                }) {
                    Icon(Icons.Default.Share, null, tint = Color.White)
                }
            }
        }

        if (r == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Receipt not found", color = c.textMuted)
            }
            return
        }

        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        ) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White)
                    .border(1.dp, c.border, RoundedCornerShape(16.dp))
                    .padding(16.dp),
            ) {
                Text(Brand.APP_NAME, style = MaterialTheme.typography.titleLarge, color = c.brand)
                Text("Kilo Taxi Receipt", style = MaterialTheme.typography.labelMedium, color = c.textMuted)
                Spacer(Modifier.height(12.dp))

                val route = remember(r.id) {
                    when {
                        r.path.size >= 2 -> r.path.map { MapPoint(it.lat, it.lng) }
                        r.startLat != null && r.startLng != null && r.endLat != null && r.endLng != null ->
                            listOf(MapPoint(r.startLat, r.startLng, "A"), MapPoint(r.endLat, r.endLng, "B"))
                        else -> emptyList()
                    }
                }
                if (route.size >= 2) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(200.dp)
                            .clip(RoundedCornerShape(12.dp)),
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
                            zoom = 14.0,
                            interactive = false,
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Start → End route",
                        style = MaterialTheme.typography.labelSmall,
                        color = c.textMuted,
                    )
                    Spacer(Modifier.height(12.dp))
                }

                ReceiptRow("From", r.startAddress)
                ReceiptRow("To", r.endAddress)
                ReceiptRow("Started", formatStamp(r.startedAtMs))
                ReceiptRow("Ended", formatStamp(r.endedAtMs))
                ReceiptRow("Distance", "%.3f km".format(r.distanceKm))
                ReceiptRow("Duration", formatMins(r.durationSec))
                ReceiptRow("Rate", "%,d MMK / km".format(r.ratePerKm))
                ReceiptRow("Base fare", "%,d MMK".format(r.baseFareMmk))
                val activeDemands = r.demands.filter { it.isActive }
                val warned = r.demandWarnings
                if (activeDemands.isNotEmpty()) {
                    activeDemands.forEach { d ->
                        ReceiptRow("Demand · ${d.name}", "+%,d MMK".format(d.amountMmk))
                    }
                    ReceiptRow("Demand total", "%,d MMK".format(r.effectiveDemandMmk))
                } else if (r.effectiveDemandMmk > 0) {
                    ReceiptRow("Demand", "%,d MMK".format(r.effectiveDemandMmk))
                }
                if (warned.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "WARNING!",
                        color = Color(0xFFD32F2F),
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                    )
                    warned.forEach { d ->
                        Text(
                            "Removed demand: ${d.name} (+%,d MMK) — not charged".format(d.amountMmk),
                            color = Color(0xFFD32F2F),
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                }
                ReceiptRow("Plate", r.plateNumber)
                if (r.driverName.isNotBlank()) ReceiptRow("Driver", r.driverName)

                Spacer(Modifier.height(12.dp))
                Box(Modifier.fillMaxWidth().height(1.dp).background(c.borderStrong))
                Spacer(Modifier.height(12.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("TOTAL", fontWeight = FontWeight.Bold, color = c.text)
                    Text(
                        "%,d MMK".format(r.fareMmk),
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 28.sp,
                        color = c.brand,
                    )
                }
            }

            Spacer(Modifier.height(16.dp))
            FpPrimaryButton("Done", onClick = onBack)
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun ReceiptRow(label: String, value: String) {
    val c = FpTheme.colors
    Row(
        Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, color = c.textMuted, style = MaterialTheme.typography.bodySmall)
        Text(
            value,
            color = c.text,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(start = 16.dp),
        )
    }
}

private fun buildShareText(r: TripReceipt): String = buildString {
    appendLine("${Brand.APP_NAME} · Kilo Taxi Receipt")
    appendLine("────────────────")
    appendLine("From: ${r.startAddress}")
    appendLine("To: ${r.endAddress}")
    appendLine("Ended: ${formatStamp(r.endedAtMs)}")
    appendLine("Distance: %.3f km".format(r.distanceKm))
    appendLine("Duration: ${formatMins(r.durationSec)}")
    r.demands.filter { it.isActive }.forEach { d ->
        appendLine("Demand · ${d.name}: +%,d MMK".format(d.amountMmk))
    }
    if (r.effectiveDemandMmk > 0 && r.demands.none { it.isActive }) {
        appendLine("Demand: %,d MMK".format(r.effectiveDemandMmk))
    }
    r.demandWarnings.forEach { d ->
        appendLine("WARNING! Removed demand: ${d.name} (+%,d MMK)".format(d.amountMmk))
    }
    appendLine("TOTAL: %,d MMK".format(r.fareMmk))
    appendLine("Plate: ${r.plateNumber}")
}
