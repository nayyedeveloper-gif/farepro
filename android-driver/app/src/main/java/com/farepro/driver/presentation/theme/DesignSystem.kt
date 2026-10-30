package com.farepro.driver.presentation.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Immutable
data class FpSpacing(
    val xxs: Dp = 4.dp,
    val xs: Dp = 8.dp,
    val sm: Dp = 12.dp,
    val md: Dp = 16.dp,
    val lg: Dp = 20.dp,
    val xl: Dp = 24.dp,
    val xxl: Dp = 32.dp,
    val xxxl: Dp = 40.dp,
    val screen: Dp = 16.dp,
    val card: Dp = 16.dp,
    val section: Dp = 24.dp,
)

@Immutable
data class FpRadius(
    val sm: Dp = 8.dp,
    val md: Dp = 12.dp,
    val lg: Dp = 16.dp,
    val xl: Dp = 20.dp,
    val full: Dp = 999.dp,
)

/** FarePro brand — blue primary, amber accent (logo palette). */
@Immutable
data class FpColors(
    val brand: Color = Color(0xFF1A73E8),
    val brandDark: Color = Color(0xFF0D47A1),
    val brandSoft: Color = Color(0x1A1A73E8),
    val accent: Color = Color(0xFFFFB300),
    val accentYellow: Color = Color(0xFFFFB300),
    val meterGreen: Color = Color(0xFF00E676),
    val meterBg: Color = Color(0xFF101820),
    val success: Color = Color(0xFF2E7D32),
    val successSoft: Color = Color(0x1A2E7D32),
    val warning: Color = Color(0xFFF9A825),
    val danger: Color = Color(0xFFD32F2F),
    val dangerSoft: Color = Color(0x1AD32F2F),
    val info: Color = Color(0xFF0288D1),
    val bg: Color = Color(0xFFF5F7FA),
    val bgElevated: Color = Color(0xFFFFFFFF),
    val surface: Color = Color(0xFFFFFFFF),
    val surfaceRaised: Color = Color(0xFFF0F3F7),
    val border: Color = Color(0x14000000),
    val borderStrong: Color = Color(0x22000000),
    val text: Color = Color(0xFF0F1C2E),
    val textSecondary: Color = Color(0xFF5A6A7A),
    val textMuted: Color = Color(0xFF8B98A6),
    val textFaint: Color = Color(0xFFB4BEC8),
    val onBrand: Color = Color.White,
    val mapScrim: Color = Color(0x990F1C2E),
    val tripToggle: Color = Color(0xFFD32F2F),
)

val LocalFpSpacing = staticCompositionLocalOf { FpSpacing() }
val LocalFpRadius = staticCompositionLocalOf { FpRadius() }
val LocalFpColors = staticCompositionLocalOf { FpColors() }

object FpTheme {
    val spacing: FpSpacing @Composable get() = LocalFpSpacing.current
    val radius: FpRadius @Composable get() = LocalFpRadius.current
    val colors: FpColors @Composable get() = LocalFpColors.current
}

object Brand {
    const val APP_NAME = "FarePro"
    const val TAGLINE = "Driver · Kilo Taxi"
}

private val FpTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 40.sp,
        lineHeight = 44.sp,
    ),
    displayMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 32.sp,
        lineHeight = 38.sp,
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 22.sp,
        lineHeight = 28.sp,
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 18.sp,
        lineHeight = 24.sp,
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 16.sp,
        lineHeight = 22.sp,
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        lineHeight = 22.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp,
    ),
    bodySmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 13.sp,
        lineHeight = 18.sp,
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 14.sp,
        lineHeight = 18.sp,
    ),
    labelMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.3.sp,
    ),
    labelSmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        lineHeight = 14.sp,
        letterSpacing = 0.4.sp,
    ),
)

@Composable
fun FareProTheme(content: @Composable () -> Unit) {
    val colors = FpColors()
    val scheme = lightColorScheme(
        primary = colors.brand,
        onPrimary = colors.onBrand,
        secondary = colors.accent,
        background = colors.bg,
        surface = colors.surface,
        onBackground = colors.text,
        onSurface = colors.text,
        error = colors.danger,
        outline = colors.borderStrong,
    )
    CompositionLocalProvider(
        LocalFpSpacing provides FpSpacing(),
        LocalFpRadius provides FpRadius(),
        LocalFpColors provides colors,
    ) {
        MaterialTheme(colorScheme = scheme, typography = FpTypography, content = content)
    }
}
