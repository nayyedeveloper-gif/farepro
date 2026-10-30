package com.farepro.driver.presentation.account

import android.Manifest
import android.app.Activity
import android.net.Uri
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.TwoWheeler
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import coil.compose.AsyncImage
import com.farepro.driver.BuildConfig
import com.farepro.driver.data.local.VehicleType
import com.farepro.driver.permissions.DriverPermissions
import com.farepro.driver.presentation.theme.Brand
import com.farepro.driver.presentation.theme.FpTheme
import java.io.File

private val ProfileRadius = 12.dp
private val ProfileSpace = 12.dp
private val ProfileScreen = 16.dp

@Composable
fun AccountScreen(
    onSignedOut: () -> Unit,
    onOpenPermissions: () -> Unit,
    onOpenComms: () -> Unit = {},
    vm: AccountViewModel = hiltViewModel(),
) {
    val ui by vm.ui.collectAsState()
    val c = FpTheme.colors
    val context = LocalContext.current
    val activity = context as Activity
    var perms by remember { mutableStateOf(DriverPermissions.snapshot(context)) }
    var showSettings by remember { mutableStateOf(false) }

    fun refreshPerms() {
        perms = DriverPermissions.snapshot(context)
        vm.setPermsSummary(perms.count { it.granted }, perms.size)
    }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val obs = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                refreshPerms()
                vm.refresh()
            }
        }
        lifecycleOwner.lifecycle.addObserver(obs)
        onDispose { lifecycleOwner.lifecycle.removeObserver(obs) }
    }

    LaunchedEffect(Unit) { refreshPerms() }

    val photoPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent(),
    ) { uri: Uri? -> vm.onPhotoPicked(uri) }

    val locationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { refreshPerms() }
    val notifLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { refreshPerms() }
    val bgLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { refreshPerms() }

    val displayName = ui.nameDraft.ifBlank { ui.user?.displayName ?: "Driver" }

    Column(Modifier.fillMaxSize().background(c.bg)) {
        // Compact top bar
        Row(
            Modifier
                .fillMaxWidth()
                .background(c.brand)
                .padding(horizontal = ProfileScreen, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text("Profile", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text(
                    listOfNotNull(ui.orgName ?: Brand.APP_NAME, ui.role).joinToString(" · "),
                    color = Color.White.copy(alpha = 0.75f),
                    fontSize = 12.sp,
                )
            }
            Box(
                Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color.White.copy(alpha = 0.15f))
                    .clickable { showSettings = !showSettings },
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Default.Settings, "Settings", tint = Color.White, modifier = Modifier.size(22.dp))
            }
        }

        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(ProfileScreen),
            verticalArrangement = Arrangement.spacedBy(ProfileSpace),
        ) {
            // Identity hero
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(ProfileRadius))
                    .background(
                        Brush.verticalGradient(
                            listOf(Color(0xFF0F1C2E), Color(0xFF1A2A40)),
                        ),
                    )
                    .padding(ProfileScreen),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(contentAlignment = Alignment.BottomEnd) {
                    ProfileAvatar(
                        photoUri = ui.photoUri,
                        name = displayName,
                        size = 88.dp,
                        onClick = { photoPicker.launch("image/*") },
                    )
                    Box(
                        Modifier
                            .size(28.dp)
                            .clip(CircleShape)
                            .background(c.brand)
                            .clickable { photoPicker.launch("image/*") },
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Default.CameraAlt, null, tint = Color.White, modifier = Modifier.size(14.dp))
                    }
                }
                Spacer(Modifier.height(10.dp))
                Text(
                    displayName,
                    color = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    ui.user?.phone.orEmpty().ifBlank { "—" },
                    color = Color.White.copy(alpha = 0.65f),
                    fontSize = 13.sp,
                )
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PillChip(ui.vehicleType.label, Color.White.copy(alpha = 0.12f), Color.White)
                    PillChip(ui.plateDraft.ifBlank { "—" }, c.brand.copy(alpha = 0.35f), c.accent)
                }
            }

            // Wallet
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(ProfileRadius))
                    .background(Color.White)
                    .border(1.dp, c.border, RoundedCornerShape(ProfileRadius))
                    .padding(horizontal = 14.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(c.brandSoft),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Default.AccountBalanceWallet, null, tint = c.brand)
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text("Wallet balance", color = c.textMuted, fontSize = 12.sp)
                    Text(
                        "%,d MMK".format(ui.wallet?.balanceMmk ?: 0),
                        color = c.text,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                    )
                }
                Text(
                    if (ui.wallet?.canReceiveJobs == false) "Low" else "OK",
                    color = if (ui.wallet?.canReceiveJobs == false) c.warning else c.success,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 12.sp,
                )
            }

            // Details card
            ProfileCard {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Driver details", fontWeight = FontWeight.SemiBold, color = c.text, fontSize = 15.sp)
                    if (ui.editing) {
                        Row {
                            TextButton(onClick = vm::cancelEditing) {
                                Text("Cancel", color = c.textMuted)
                            }
                            TextButton(onClick = vm::saveProfile, enabled = !ui.saving) {
                                Text(if (ui.saving) "Saving…" else "Save", color = c.brand, fontWeight = FontWeight.Bold)
                            }
                        }
                    } else {
                        TextButton(onClick = vm::startEditing) {
                            Icon(Icons.Default.Edit, null, tint = c.brand, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Edit", color = c.brand, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }

                if (ui.savedFlash && !ui.editing) {
                    Text("Saved", color = c.success, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }

                if (ui.editing) {
                    ProfileField("Driver name", ui.nameDraft, vm::onNameDraft)
                    ProfileField(
                        "Plate No",
                        ui.plateDraft,
                        vm::onPlateDraft,
                        caps = true,
                    )
                    Text("Type", color = c.textMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(6.dp))
                    VehicleTypePicker(ui.vehicleType, vm::onVehicleType)
                    Spacer(Modifier.height(10.dp))
                    ProfileField("Address", ui.addressDraft, vm::onAddressDraft, singleLine = false)
                } else {
                    DetailRow(Icons.Default.Person, "Driver name", displayName)
                    DetailRow(Icons.Default.DirectionsCar, "Plate No", ui.plateDraft)
                    DetailRow(
                        if (ui.vehicleType == VehicleType.THONE_BANE) Icons.Default.TwoWheeler else Icons.Default.DirectionsCar,
                        "Type",
                        ui.vehicleType.label,
                    )
                    DetailRow(
                        Icons.Default.LocationOn,
                        "Address",
                        ui.addressDraft.ifBlank { "Not set" },
                        muted = ui.addressDraft.isBlank(),
                    )
                }
            }

            // Quick stats
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                MiniStat("Trips", "%,d".format(ui.tripCount), Modifier.weight(1f))
                MiniStat("Rate", "%,d/km".format(ui.rates.ratePerKm), Modifier.weight(1f))
                MiniStat("Demand", "%,d".format(ui.demandCatalog.size), Modifier.weight(1f))
            }

            ProfileCard {
                SettingsRow(
                    icon = Icons.Default.Chat,
                    title = "PTT & Messages",
                    subtitle = "Radio hold-to-talk · channel & trip chat",
                    onClick = onOpenComms,
                )
            }

            // Settings panel
            if (showSettings) {
                ProfileCard {
                    Text("Settings", fontWeight = FontWeight.SemiBold, color = c.text, fontSize = 15.sp)
                    SettingsRow(
                        icon = Icons.Default.Security,
                        title = "Permissions",
                        subtitle = "${ui.permsGranted}/${ui.permsTotal} ready",
                        onClick = onOpenPermissions,
                    )
                    perms.take(3).forEach { item ->
                        CompactPermRow(
                            title = item.title,
                            on = item.granted,
                            onClick = {
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
                            },
                        )
                    }
                    SettingsRow(
                        icon = Icons.Default.Settings,
                        title = "App system settings",
                        subtitle = "Android app info",
                        onClick = { DriverPermissions.openAppSettings(context) },
                    )
                    if (!ui.wallet?.paymentInfo.isNullOrBlank()) {
                        Text(
                            ui.wallet?.paymentInfo.orEmpty(),
                            color = c.textMuted,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                }
            } else {
                ProfileCard {
                    SettingsRow(
                        icon = Icons.Default.Security,
                        title = "Permissions & settings",
                        subtitle = "${ui.permsGranted}/${ui.permsTotal} · tap gear or here",
                        onClick = { showSettings = true },
                    )
                }
            }

            // Sign out
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .clip(RoundedCornerShape(ProfileRadius))
                    .background(c.dangerSoft)
                    .clickable { vm.signOut(onSignedOut) },
                contentAlignment = Alignment.Center,
            ) {
                Text("Sign out", color = c.danger, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            }

            Text(
                "FarePro · ${BuildConfig.VERSION_NAME}",
                color = c.textFaint,
                fontSize = 11.sp,
                modifier = Modifier.align(Alignment.CenterHorizontally),
            )
            ui.subdomain?.takeIf { it.isNotBlank() }?.let {
                Text(
                    "$it.farepro.app",
                    color = c.textFaint,
                    fontSize = 11.sp,
                    modifier = Modifier.align(Alignment.CenterHorizontally),
                )
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun ProfileAvatar(
    photoUri: String,
    name: String,
    size: androidx.compose.ui.unit.Dp,
    onClick: () -> Unit,
) {
    val c = FpTheme.colors
    val model: Any? = when {
        photoUri.isBlank() -> null
        photoUri.startsWith("/") -> File(photoUri)
        else -> photoUri
    }
    Box(
        Modifier
            .size(size)
            .clip(CircleShape)
            .background(c.brandSoft)
            .border(2.dp, Color.White.copy(alpha = 0.35f), CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        if (model != null) {
            AsyncImage(
                model = model,
                contentDescription = "Profile photo",
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        } else {
            Text(
                name.firstOrNull()?.uppercaseChar()?.toString() ?: "D",
                color = c.brand,
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun ProfileCard(content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    val c = FpTheme.colors
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ProfileRadius))
            .background(Color.White)
            .border(1.dp, c.border, RoundedCornerShape(ProfileRadius))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        content = content,
    )
}

@Composable
private fun DetailRow(
    icon: ImageVector,
    label: String,
    value: String,
    muted: Boolean = false,
) {
    val c = FpTheme.colors
    Row(
        Modifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = c.textMuted, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(label, color = c.textMuted, fontSize = 11.sp)
            Text(
                value,
                color = if (muted) c.textFaint else c.text,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun ProfileField(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    caps: Boolean = false,
    singleLine: Boolean = true,
) {
    val c = FpTheme.colors
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        modifier = Modifier.fillMaxWidth(),
        label = { Text(label) },
        singleLine = singleLine,
        minLines = if (singleLine) 1 else 2,
        maxLines = if (singleLine) 1 else 3,
        keyboardOptions = KeyboardOptions(
            capitalization = if (caps) KeyboardCapitalization.Characters else KeyboardCapitalization.Words,
        ),
        shape = RoundedCornerShape(10.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = c.brand,
            unfocusedBorderColor = c.borderStrong,
            focusedLabelColor = c.brand,
        ),
    )
}

@Composable
private fun VehicleTypePicker(selected: VehicleType, onSelect: (VehicleType) -> Unit) {
    val c = FpTheme.colors
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        VehicleType.entries.forEach { type ->
            val on = type == selected
            Row(
                Modifier
                    .weight(1f)
                    .height(44.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(if (on) c.brand else c.surfaceRaised)
                    .border(1.dp, if (on) c.brand else c.border, RoundedCornerShape(10.dp))
                    .clickable { onSelect(type) }
                    .padding(horizontal = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                Icon(
                    if (type == VehicleType.THONE_BANE) Icons.Default.TwoWheeler else Icons.Default.DirectionsCar,
                    null,
                    tint = if (on) Color.White else c.text,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    type.label,
                    color = if (on) Color.White else c.text,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                )
                if (on) {
                    Spacer(Modifier.width(4.dp))
                    Icon(Icons.Default.Check, null, tint = Color.White, modifier = Modifier.size(14.dp))
                }
            }
        }
    }
}

@Composable
private fun MiniStat(label: String, value: String, modifier: Modifier = Modifier) {
    val c = FpTheme.colors
    Column(
        modifier
            .clip(RoundedCornerShape(ProfileRadius))
            .background(Color.White)
            .border(1.dp, c.border, RoundedCornerShape(ProfileRadius))
            .padding(12.dp),
    ) {
        Text(label, color = c.textMuted, fontSize = 11.sp)
        Text(value, color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp, fontFamily = FontFamily.Monospace)
    }
}

@Composable
private fun SettingsRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
) {
    val c = FpTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(36.dp)
                .clip(RoundedCornerShape(9.dp))
                .background(c.surfaceRaised),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, null, tint = c.brand, modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = c.text, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Text(subtitle, color = c.textMuted, fontSize = 12.sp)
        }
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = c.textFaint)
    }
}

@Composable
private fun CompactPermRow(title: String, on: Boolean, onClick: () -> Unit) {
    val c = FpTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(c.bg)
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, color = c.text, fontSize = 13.sp)
        Text(
            if (on) "ON" else "OFF",
            color = if (on) c.success else c.warning,
            fontWeight = FontWeight.Bold,
            fontSize = 12.sp,
        )
    }
}

@Composable
private fun PillChip(text: String, bg: Color, fg: Color) {
    Text(
        text,
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .padding(horizontal = 10.dp, vertical = 4.dp),
        color = fg,
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
    )
}
