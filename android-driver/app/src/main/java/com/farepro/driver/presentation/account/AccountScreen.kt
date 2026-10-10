package com.farepro.driver.presentation.account

import android.app.Activity
import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.farepro.driver.BuildConfig
import com.farepro.driver.permissions.DriverPermissions
import com.farepro.driver.presentation.components.FpAvatar
import com.farepro.driver.presentation.components.FpCard
import com.farepro.driver.presentation.components.FpHGap
import com.farepro.driver.presentation.components.FpInlineError
import com.farepro.driver.presentation.components.FpPrimaryButton
import com.farepro.driver.presentation.components.FpScreenHeader
import com.farepro.driver.presentation.components.FpSectionLabel
import com.farepro.driver.presentation.components.FpSecondaryButton
import com.farepro.driver.presentation.components.FpVGap
import com.farepro.driver.presentation.theme.FpTheme

@Composable
fun AccountScreen(
    onSignedOut: () -> Unit,
    onOpenPermissions: () -> Unit,
    vm: AccountViewModel = hiltViewModel(),
) {
    val ui by vm.ui.collectAsState()
    val s = FpTheme.spacing
    val c = FpTheme.colors
    val context = LocalContext.current
    val activity = context as Activity
    var perms by remember { mutableStateOf(DriverPermissions.snapshot(context)) }

    fun refreshPerms() {
        perms = DriverPermissions.snapshot(context)
    }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val obs = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) refreshPerms()
        }
        lifecycleOwner.lifecycle.addObserver(obs)
        onDispose { lifecycleOwner.lifecycle.removeObserver(obs) }
    }

    val locationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { refreshPerms() }
    val notifLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { refreshPerms() }
    val bgLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { refreshPerms() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(c.bg)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = s.screen),
    ) {
        FpScreenHeader(title = "Account", subtitle = "Profile, wallet & permissions")

        FpCard {
            Row {
                FpAvatar(ui.user?.displayName?.firstOrNull()?.toString() ?: "D")
                FpHGap(s.sm)
                Column {
                    Text(
                        ui.user?.displayName ?: "Driver",
                        style = MaterialTheme.typography.titleLarge,
                        color = c.text,
                    )
                    Text(ui.user?.phone.orEmpty(), style = MaterialTheme.typography.bodySmall, color = c.textMuted)
                    Text(
                        listOfNotNull(ui.orgName, ui.role).joinToString(" · "),
                        style = MaterialTheme.typography.labelMedium,
                        color = c.brand,
                    )
                }
            }
        }

        FpSectionLabel("Wallet")
        FpCard {
            Text("Available balance", style = MaterialTheme.typography.labelMedium, color = c.textMuted)
            Text(
                "%,d MMK".format(ui.wallet?.balanceMmk ?: 0),
                style = MaterialTheme.typography.displayMedium,
                color = c.text,
            )
            Text(
                if (ui.wallet?.canReceiveJobs == false) {
                    "Job offers paused — top up wallet"
                } else {
                    "Ready to receive dispatch jobs"
                },
                style = MaterialTheme.typography.bodySmall,
                color = if (ui.wallet?.canReceiveJobs == false) c.warning else c.success,
            )
            ui.wallet?.paymentInfo?.takeIf { it.isNotBlank() }?.let {
                FpVGap(s.xs)
                Text(it, style = MaterialTheme.typography.bodySmall, color = c.textMuted)
            }
        }

        FpSectionLabel("Permissions")
        FpCard {
            Text(
                "Required for background GPS, floating KM, and reboot resume.",
                style = MaterialTheme.typography.bodySmall,
                color = c.textMuted,
            )
            FpVGap(s.xs)
            perms.forEach { item ->
                val shape = RoundedCornerShape(FpTheme.radius.md)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(shape)
                        .background(c.bgElevated)
                        .border(1.dp, c.border, shape)
                        .clickable {
                            when (item.id) {
                                DriverPermissions.ID_LOCATION ->
                                    locationLauncher.launch(DriverPermissions.runtimeLocationPerms())
                                DriverPermissions.ID_NOTIFICATIONS -> {
                                    val p = DriverPermissions.runtimeNotificationPerms()
                                    if (p.isNotEmpty()) notifLauncher.launch(p)
                                }
                                DriverPermissions.ID_BACKGROUND -> {
                                    if (!DriverPermissions.fineLocationGranted(context)) {
                                        locationLauncher.launch(DriverPermissions.runtimeLocationPerms())
                                    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                                        bgLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                                    }
                                }
                                DriverPermissions.ID_OVERLAY ->
                                    DriverPermissions.openOverlaySettings(context)
                                DriverPermissions.ID_BATTERY ->
                                    DriverPermissions.openBatterySettings(activity)
                            }
                        }
                        .padding(horizontal = s.sm, vertical = s.sm),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(item.title, style = MaterialTheme.typography.titleMedium, color = c.text)
                        Text(item.subtitle, style = MaterialTheme.typography.labelSmall, color = c.textMuted)
                    }
                    Text(
                        if (item.granted) "ON" else "OFF",
                        style = MaterialTheme.typography.labelLarge,
                        color = if (item.granted) c.success else c.warning,
                    )
                }
                FpVGap(s.xs)
            }
            FpSecondaryButton("Open full permission setup", onOpenPermissions)
            FpVGap(s.xs)
            FpSecondaryButton("App system settings", { DriverPermissions.openAppSettings(context) })
        }

        FpInlineError(ui.error)
        FpVGap(s.section)
        FpPrimaryButton("Sign out", onClick = { vm.signOut(onSignedOut) })
        FpVGap(s.md)
        Text(
            "FarePro Kotlin · ${BuildConfig.VERSION_NAME}",
            style = MaterialTheme.typography.labelSmall,
            color = c.textFaint,
        )
        Text(
            BuildConfig.API_BASE_URL.trimEnd('/'),
            style = MaterialTheme.typography.labelSmall,
            color = c.textFaint,
        )
        FpVGap(s.xl)
    }
}
