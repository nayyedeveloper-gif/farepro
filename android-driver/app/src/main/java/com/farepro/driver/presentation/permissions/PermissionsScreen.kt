package com.farepro.driver.presentation.permissions

import android.Manifest
import android.app.Activity
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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BatteryChargingFull
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Public
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.farepro.driver.data.local.TripSessionStore
import com.farepro.driver.permissions.DriverPermissions
import com.farepro.driver.permissions.PermissionItem
import com.farepro.driver.presentation.components.FpPrimaryButton
import com.farepro.driver.presentation.components.FpSecondaryButton
import com.farepro.driver.presentation.components.FpVGap
import com.farepro.driver.presentation.theme.FpTheme
import kotlinx.coroutines.launch

@Composable
fun PermissionsScreen(
    tripSessionStore: TripSessionStore,
    onContinue: () -> Unit,
    allowSkip: Boolean = false,
) {
    val context = LocalContext.current
    val activity = context as Activity
    val scope = rememberCoroutineScope()
    val c = FpTheme.colors
    val s = FpTheme.spacing
    var items by remember { mutableStateOf(DriverPermissions.snapshot(context)) }

    fun refresh() {
        items = DriverPermissions.snapshot(context)
    }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val obs = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) refresh()
        }
        lifecycleOwner.lifecycle.addObserver(obs)
        onDispose { lifecycleOwner.lifecycle.removeObserver(obs) }
    }

    val locationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { refresh() }

    val notifLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { refresh() }

    val backgroundLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { refresh() }

    fun request(item: PermissionItem) {
        when (item.id) {
            DriverPermissions.ID_LOCATION ->
                locationLauncher.launch(DriverPermissions.runtimeLocationPerms())
            DriverPermissions.ID_NOTIFICATIONS -> {
                val perms = DriverPermissions.runtimeNotificationPerms()
                if (perms.isEmpty()) refresh() else notifLauncher.launch(perms)
            }
            DriverPermissions.ID_BACKGROUND -> {
                if (!DriverPermissions.fineLocationGranted(context)) {
                    locationLauncher.launch(DriverPermissions.runtimeLocationPerms())
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    backgroundLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                } else {
                    refresh()
                }
            }
            DriverPermissions.ID_OVERLAY -> DriverPermissions.openOverlaySettings(context)
            DriverPermissions.ID_BATTERY -> DriverPermissions.openBatterySettings(activity)
        }
    }

    val allRequired = items.filter { it.required }.all { it.granted }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(c.bg)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = s.screen)
            .padding(top = s.xxxl, bottom = s.xxl),
    ) {
        Text("Driver setup", style = MaterialTheme.typography.displayMedium, color = c.text)
        FpVGap(s.xs)
        Text(
            "Enable these once so live GPS, floating KM, and reboot resume work together.",
            style = MaterialTheme.typography.bodyMedium,
            color = c.textMuted,
        )
        FpVGap(s.section)

        items.forEach { item ->
            PermissionRow(
                item = item,
                icon = iconFor(item.id),
                onClick = { request(item) },
            )
            FpVGap(s.sm)
        }

        FpVGap(s.md)
        FpPrimaryButton(
            label = if (allRequired) "Continue" else "Enable required permissions",
            onClick = {
                if (allRequired) {
                    scope.launch {
                        tripSessionStore.setPermissionsSetupDone(true)
                        onContinue()
                    }
                } else {
                    items.firstOrNull { it.required && !it.granted }?.let { request(it) }
                }
            },
        )
        if (allowSkip) {
            FpVGap(s.sm)
            FpSecondaryButton(
                label = "Skip for now",
                onClick = {
                    scope.launch {
                        tripSessionStore.setPermissionsSetupDone(true)
                        onContinue()
                    }
                },
            )
        }
        FpVGap(s.sm)
        Text(
            "You can change these anytime in Account → Permissions.",
            style = MaterialTheme.typography.labelSmall,
            color = c.textFaint,
        )
    }
}

@Composable
private fun PermissionRow(
    item: PermissionItem,
    icon: ImageVector,
    onClick: () -> Unit,
) {
    val c = FpTheme.colors
    val s = FpTheme.spacing
    val shape = RoundedCornerShape(FpTheme.radius.lg)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(c.surface)
            .border(1.dp, if (item.granted) c.success.copy(alpha = 0.35f) else c.border, shape)
            .clickable(onClick = onClick)
            .padding(s.card),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(s.sm),
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(if (item.granted) c.successSoft else c.brandSoft),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                icon,
                contentDescription = null,
                tint = if (item.granted) c.success else c.brand,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(item.title, style = MaterialTheme.typography.titleMedium, color = c.text)
            Text(item.subtitle, style = MaterialTheme.typography.bodySmall, color = c.textMuted)
            if (!item.required) {
                Text("Recommended", style = MaterialTheme.typography.labelSmall, color = c.textFaint)
            }
        }
        if (item.granted) {
            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = c.success)
        } else {
            Text(
                "Allow",
                style = MaterialTheme.typography.labelLarge,
                color = c.brand,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

private fun iconFor(id: String): ImageVector = when (id) {
    DriverPermissions.ID_LOCATION -> Icons.Default.LocationOn
    DriverPermissions.ID_BACKGROUND -> Icons.Default.Public
    DriverPermissions.ID_NOTIFICATIONS -> Icons.Default.Notifications
    DriverPermissions.ID_OVERLAY -> Icons.Default.Layers
    DriverPermissions.ID_BATTERY -> Icons.Default.BatteryChargingFull
    else -> Icons.Default.CheckCircle
}
