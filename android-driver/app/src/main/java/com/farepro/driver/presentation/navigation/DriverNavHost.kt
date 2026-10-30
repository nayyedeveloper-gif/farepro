package com.farepro.driver.presentation.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Place
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
import androidx.compose.ui.graphics.Color
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
import com.farepro.driver.presentation.comms.CommsScreen
import com.farepro.driver.presentation.dashboard.DashboardScreen
import com.farepro.driver.presentation.home.HomeScreen
import com.farepro.driver.presentation.login.LoginScreen
import com.farepro.driver.presentation.login.LoginViewModel
import com.farepro.driver.presentation.permissions.PermissionsScreen
import com.farepro.driver.presentation.receipt.ReceiptScreen
import com.farepro.driver.presentation.theme.FpTheme
import com.farepro.driver.presentation.trips.TripsScreen
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

object Routes {
    const val Login = "login"
    const val Permissions = "permissions"
    const val Home = "home"
    const val Trips = "trips"
    const val Dashboard = "dashboard"
    const val Apps = "apps"
    const val Comms = "comms"
    fun receipt(id: String) = "receipt/$id"
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
    val hideBottom = route == Routes.Login ||
        route == Routes.Permissions ||
        route == Routes.Comms ||
        route.startsWith("receipt")
    val showBottom = loggedIn && !hideBottom
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
            nav.navigate(Routes.Permissions) { launchSingleTop = true }
        } else if (openMeter) {
            nav.navigate(Routes.Home) { launchSingleTop = true }
        }
        checkedGate = true
    }

    Scaffold(
        containerColor = c.bg,
        bottomBar = {
            if (showBottom) {
                NavigationBar(
                    containerColor = Color.White,
                    tonalElevation = 0.dp,
                    windowInsets = NavigationBarDefaults.windowInsets,
                    // Square bar — match kilo-taxi fixed chrome
                ) {
                    val colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = c.brand,
                        selectedTextColor = c.brand,
                        unselectedIconColor = c.textMuted,
                        unselectedTextColor = c.textMuted,
                        indicatorColor = c.brandSoft,
                    )
                    NavigationBarItem(
                        selected = route == Routes.Home,
                        onClick = { nav.navigate(Routes.Home) { launchSingleTop = true } },
                        icon = { Icon(Icons.Default.Home, null) },
                        label = { Text("Home") },
                        colors = colors,
                    )
                    NavigationBarItem(
                        selected = route == Routes.Trips || route.startsWith("receipt"),
                        onClick = { nav.navigate(Routes.Trips) { launchSingleTop = true } },
                        icon = { Icon(Icons.Default.Place, null) },
                        label = { Text("Trips") },
                        colors = colors,
                    )
                    NavigationBarItem(
                        selected = route == Routes.Dashboard,
                        onClick = { nav.navigate(Routes.Dashboard) { launchSingleTop = true } },
                        icon = { Icon(Icons.Default.BarChart, null) },
                        label = { Text("Dashboard") },
                        colors = colors,
                    )
                    NavigationBarItem(
                        selected = route == Routes.Apps,
                        onClick = { nav.navigate(Routes.Apps) { launchSingleTop = true } },
                        icon = { Icon(Icons.Default.Person, null) },
                        label = { Text("Profile") },
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
                else -> Routes.Home
            },
            modifier = Modifier.padding(padding),
        ) {
            composable(Routes.Login) {
                LoginScreen(
                    onLoggedIn = {
                        val needPerms = !DriverPermissions.allRequiredGranted(context)
                        nav.navigate(if (needPerms) Routes.Permissions else Routes.Home) {
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
                        nav.navigate(Routes.Home) {
                            popUpTo(Routes.Permissions) { inclusive = true }
                        }
                    },
                )
            }
            composable(Routes.Home) {
                HomeScreen(
                    onReceipt = { receipt -> nav.navigate(Routes.receipt(receipt.id)) },
                    onOpenApps = { nav.navigate(Routes.Apps) { launchSingleTop = true } },
                    onOpenComms = { nav.navigate(Routes.Comms) { launchSingleTop = true } },
                )
            }
            composable(Routes.Comms) {
                CommsScreen(onBack = { nav.popBackStack() })
            }
            composable(Routes.Trips) {
                TripsScreen(
                    onOpenReceipt = { id -> nav.navigate(Routes.receipt(id)) },
                    onOpenMenu = { nav.navigate(Routes.Apps) { launchSingleTop = true } },
                )
            }
            composable(Routes.Dashboard) {
                DashboardScreen(
                    onOpenMenu = { nav.navigate(Routes.Apps) { launchSingleTop = true } },
                    onOpenTrip = { id -> nav.navigate(Routes.receipt(id)) },
                )
            }
            composable(Routes.Apps) {
                AccountScreen(
                    onSignedOut = {
                        nav.navigate(Routes.Login) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                    onOpenPermissions = {
                        nav.navigate(Routes.Permissions) { launchSingleTop = true }
                    },
                    onOpenComms = { nav.navigate(Routes.Comms) { launchSingleTop = true } },
                )
            }
            composable(
                route = "receipt/{id}",
                arguments = listOf(navArgument("id") { type = NavType.StringType }),
            ) { entry ->
                ReceiptScreen(
                    receiptId = entry.arguments?.getString("id").orEmpty(),
                    onBack = { nav.popBackStack() },
                )
            }
        }
    }
}
