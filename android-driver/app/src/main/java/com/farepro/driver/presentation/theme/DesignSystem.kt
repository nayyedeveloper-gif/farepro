package com.farepro.driver.presentation.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
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

/** 8dp-grid spacing — use these everywhere, never raw magic numbers in screens. */
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
    val screen: Dp = 20.dp,
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

@Immutable
data class FpColors(
    val brand: Color = Color(0xFFF26522),
    val brandSoft: Color = Color(0x1AF26522),
    val success: Color = Color(0xFF2D9C78),
    val successSoft: Color = Color(0x1A2D9C78),
    val warning: Color = Color(0xFFF39C12),
    val danger: Color = Color(0xFFE74C3C),
    val dangerSoft: Color = Color(0x1AE74C3C),
    val info: Color = Color(0xFF3B82F6),
    val bg: Color = Color(0xFF080C10),
    val bgElevated: Color = Color(0xFF0E1419),
    val surface: Color = Color(0xFF141C24),
    val surfaceRaised: Color = Color(0xFF1A2430),
    val border: Color = Color(0x14FFFFFF),
    val borderStrong: Color = Color(0x24FFFFFF),
    val text: Color = Color(0xFFEEF2F6),
    val textSecondary: Color = Color(0xA6EEF2F6),
    val textMuted: Color = Color(0x66EEF2F6),
    val textFaint: Color = Color(0x40EEF2F6),
    val onBrand: Color = Color.White,
    val mapScrim: Color = Color(0xCC080C10),
)

val LocalFpSpacing = staticCompositionLocalOf { FpSpacing() }
val LocalFpRadius = staticCompositionLocalOf { FpRadius() }
val LocalFpColors = staticCompositionLocalOf { FpColors() }

object FpTheme {
    val spacing: FpSpacing @Composable get() = LocalFpSpacing.current
    val radius: FpRadius @Composable get() = LocalFpRadius.current
    val colors: FpColors @Composable get() = LocalFpColors.current
}

private val FpTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 40.sp,
        lineHeight = 44.sp,
        letterSpacing = (-0.5).sp,
    ),
    displayMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 34.sp,
        lineHeight = 40.sp,
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
        letterSpacing = 0.4.sp,
    ),
    labelSmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        lineHeight = 14.sp,
        letterSpacing = 0.6.sp,
    ),
)

@Composable
fun FareProTheme(content: @Composable () -> Unit) {
    val colors = FpColors()
    val scheme = darkColorScheme(
        primary = colors.brand,
        onPrimary = colors.onBrand,
        secondary = colors.success,
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
        MaterialTheme(
            colorScheme = scheme,
            typography = FpTypography,
            content = content,
        )
    }
}
