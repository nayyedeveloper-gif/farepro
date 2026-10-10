package com.farepro.driver.presentation.login

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.farepro.driver.BuildConfig
import com.farepro.driver.presentation.components.FpCard
import com.farepro.driver.presentation.components.FpField
import com.farepro.driver.presentation.components.FpInlineError
import com.farepro.driver.presentation.components.FpPrimaryButton
import com.farepro.driver.presentation.components.FpVGap
import com.farepro.driver.presentation.theme.FpTheme

@Composable
fun LoginScreen(
    onLoggedIn: () -> Unit,
    vm: LoginViewModel = hiltViewModel(),
) {
    val ui by vm.ui.collectAsState()
    val s = FpTheme.spacing
    val c = FpTheme.colors

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(c.bg, c.bgElevated, c.bg),
                ),
            ),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(220.dp)
                .background(
                    Brush.verticalGradient(
                        listOf(c.brand.copy(alpha = 0.28f), c.bg.copy(alpha = 0f)),
                    ),
                ),
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = s.screen)
                .padding(top = 72.dp, bottom = s.xxl),
            horizontalAlignment = Alignment.Start,
        ) {
            Text(
                "FarePro",
                style = MaterialTheme.typography.displayMedium,
                color = c.brand,
                fontWeight = FontWeight.ExtraBold,
            )
            Text(
                "Driver",
                style = MaterialTheme.typography.displayLarge,
                color = c.text,
            )
            FpVGap(s.xs)
            Text(
                "Live map · kilo jobs · accurate GPS meter",
                style = MaterialTheme.typography.bodyMedium,
                color = c.textMuted,
            )
            FpVGap(s.section)

            FpCard {
                Text("Stand sign-in", style = MaterialTheme.typography.titleLarge, color = c.text)
                Text(
                    "Phone registered to your taxi stand.",
                    style = MaterialTheme.typography.bodySmall,
                    color = c.textMuted,
                )
                FpVGap(s.sm)
                FpField(ui.subdomain, vm::onSubdomain, "Taxi stand code")
                FpField(ui.phone, vm::onPhone, "Phone")
                FpField(
                    value = ui.password,
                    onValueChange = vm::onPassword,
                    label = "Password",
                    visualTransformation = PasswordVisualTransformation(),
                )
                FpInlineError(ui.error)
                FpVGap(s.xs)
                FpPrimaryButton(
                    label = "Go online",
                    loading = ui.loading,
                    onClick = { vm.login(onLoggedIn) },
                )
            }

            FpVGap(s.lg)
            Text(
                "Demo · stand demo · 09000000201 / Demo@2026",
                style = MaterialTheme.typography.labelSmall,
                color = c.textFaint,
            )
            Text(
                BuildConfig.API_BASE_URL.trimEnd('/'),
                style = MaterialTheme.typography.labelSmall,
                color = c.textFaint,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = s.xs),
            )
        }
    }
}
