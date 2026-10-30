package com.farepro.driver.presentation.login

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.farepro.driver.R
import com.farepro.driver.presentation.components.FpCard
import com.farepro.driver.presentation.components.FpField
import com.farepro.driver.presentation.components.FpInlineError
import com.farepro.driver.presentation.components.FpPrimaryButton
import com.farepro.driver.presentation.components.FpVGap
import com.farepro.driver.presentation.theme.Brand
import com.farepro.driver.presentation.theme.FpTheme

@Composable
fun LoginScreen(
    onLoggedIn: () -> Unit,
    vm: LoginViewModel = hiltViewModel(),
) {
    val ui by vm.ui.collectAsState()
    val s = FpTheme.spacing
    val c = FpTheme.colors

    Box(Modifier.fillMaxSize().background(c.bg)) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = s.screen)
                .padding(top = 56.dp, bottom = s.xxl),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Image(
                painter = painterResource(R.drawable.farepro_logo),
                contentDescription = Brand.APP_NAME,
                modifier = Modifier
                    .size(112.dp)
                    .clip(RoundedCornerShape(24.dp)),
                contentScale = ContentScale.Crop,
            )
            FpVGap(s.md)
            Text(
                Brand.APP_NAME,
                style = MaterialTheme.typography.displayMedium,
                color = c.text,
                fontWeight = FontWeight.Bold,
            )
            Text(Brand.TAGLINE, style = MaterialTheme.typography.bodyMedium, color = c.textMuted)
            FpVGap(s.section)

            FpCard {
                Text("Driver sign-in", style = MaterialTheme.typography.titleLarge, color = c.text)
                Text(
                    "Use your stand credentials to go online.",
                    style = MaterialTheme.typography.bodySmall,
                    color = c.textMuted,
                )
                FpVGap(s.sm)
                FpField(ui.subdomain, vm::onSubdomain, "Stand code")
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
                    label = "Sign in",
                    loading = ui.loading,
                    onClick = { vm.login(onLoggedIn) },
                )
            }

            FpVGap(s.lg)
            Text(
                "Production builds use your stand code from dispatch.",
                style = MaterialTheme.typography.labelSmall,
                color = c.textFaint,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
