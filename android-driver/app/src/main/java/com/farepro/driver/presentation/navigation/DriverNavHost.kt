package com.farepro.driver.presentation.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarDefaults
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.farepro.driver.data.local.TripSessionStore
import com.farepro.driver.permissions.DriverPermissions
import com.farepro.driver.presentation.account.AccountScreen
import com.farepro.driver.presentation.jobs.JobsScreen
import com.farepro.driver.presentation.login.LoginScreen
import com.farepro.driver.presentation.login.LoginViewModel
import com.farepro.driver.presentation.meter.MeterScreen
import com.farepro.driver.presentation.permissions.PermissionsScreen
import com.farepro.driver.presentation.theme.FpTheme
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

object Routes {
    const val Login = "login"
    const val Permissions = "permissions"
    const val Jobs = "jobs"
    const val Account = "account"

    fun meter(tripId: String? = null) =
        if (tripId.isNullOrBlank()) "meter" else "meter?tripId=$tripId"
}

@EntryPoint
@InstallIn(SingletonComponent::class)
interface TripSessionEntryPoint {
    fun tripSessionStore(): TripSessionStore
}

@Composable
fun DriverNavHost(
    openMeter: Boolean = false,
    loginVm: LoginViewModel = hiltViewModel(),
) {
    val loggedIn by loginVm.isLoggedIn.collectAsState(initial = false)
    val nav = rememberNavController()
    val backStack by nav.currentBackStackEntryAsState()
    val route = backStack?.destination?.route.orEmpty()
    val showBottom = loggedIn &&
        route != Routes.Login &&
        route != Routes.Permissions
    val c = FpTheme.colors
    val context = LocalContext.current
    val tripStore = remember {
        EntryPointAccessors.fromApplication(
            context.applicationContext,
            TripSessionEntryPoint::class.java,
        ).tripSessionStore()
    }
    val permsDone by tripStore.permissionsSetupDoneFlow.collectAsState(initial = false)
    var checkedGate by remember { mutableStateOf(false) }

    LaunchedEffect(loggedIn, permsDone, openMeter) {
        if (!loggedIn) {
            checkedGate = false
            return@LaunchedEffect
        }
        val needPerms = !permsDone || !DriverPermissions.allRequiredGranted(context)
        if (needPerms && route != Routes.Permissions) {
            nav.navigate(Routes.Permissions) {
                launchSingleTop = true
            }
        } else if (openMeter) {
            nav.navigate(Routes.meter()) { launchSingleTop = true }
        }
        checkedGate = true
    }

    Scaffold(
        containerColor = c.bg,
        bottomBar = {
            if (showBottom) {
                NavigationBar(
                    containerColor = c.bgElevated,
                    tonalElevation = 0.dp,
                    windowInsets = NavigationBarDefaults.windowInsets,
                ) {
                    val colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = c.brand,
                        selectedTextColor = c.brand,
                        unselectedIconColor = c.textMuted,
                        unselectedTextColor = c.textMuted,
                        indicatorColor = c.brandSoft,
                    )
                    NavigationBarItem(
                        selected = route.startsWith("jobs"),
                        onClick = { nav.navigate(Routes.Jobs) { launchSingleTop = true } },
                        icon = { Icon(Icons.Default.Map, contentDescription = null) },
                        label = { Text("Map") },
                        colors = colors,
                    )
                    NavigationBarItem(
                        selected = route.startsWith("meter"),
                        onClick = { nav.navigate(Routes.meter()) { launchSingleTop = true } },
                        icon = { Icon(Icons.Default.Speed, contentDescription = null) },
                        label = { Text("Meter") },
                        colors = colors,
                    )
                    NavigationBarItem(
                        selected = route.startsWith("account"),
                        onClick = { nav.navigate(Routes.Account) { launchSingleTop = true } },
                        icon = { Icon(Icons.Default.AccountCircle, contentDescription = null) },
                        label = { Text("Account") },
                        colors = colors,
                    )
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = nav,
            startDestination = when {
                !loggedIn -> Routes.Login
                !permsDone || !DriverPermissions.allRequiredGranted(context) -> Routes.Permissions
                else -> Routes.Jobs
            },
            modifier = Modifier.padding(padding),
        ) {
            composable(Routes.Login) {
                LoginScreen(
                    onLoggedIn = {
                        val needPerms = !DriverPermissions.allRequiredGranted(context)
                        nav.navigate(if (needPerms) Routes.Permissions else Routes.Jobs) {
                            popUpTo(Routes.Login) { inclusive = true }
                        }
                    },
                )
            }
            composable(Routes.Permissions) {
                PermissionsScreen(
                    tripSessionStore = tripStore,
                    allowSkip = checkedGate || permsDone,
                    onContinue = {
                        nav.navigate(Routes.Jobs) {
                            popUpTo(Routes.Permissions) { inclusive = true }
                        }
                    },
                )
            }
            composable(Routes.Jobs) {
                JobsScreen(onOpenMeter = { tripId -> nav.navigate(Routes.meter(tripId)) })
            }
            composable(
                route = "meter?tripId={tripId}",
                arguments = listOf(
                    navArgument("tripId") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                ),
            ) { entry ->
                MeterScreen(tripId = entry.arguments?.getString("tripId"))
            }
            composable("meter") {
                MeterScreen(tripId = null)
            }
            composable(Routes.Account) {
                AccountScreen(
                    onSignedOut = {
                        nav.navigate(Routes.Login) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                    onOpenPermissions = {
                        nav.navigate(Routes.Permissions) { launchSingleTop = true }
                    },
                )
            }
        }
    }
}
