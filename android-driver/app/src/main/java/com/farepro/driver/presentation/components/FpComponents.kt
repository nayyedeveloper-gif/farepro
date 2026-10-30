package com.farepro.driver.presentation.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.farepro.driver.presentation.theme.FpTheme

@Composable
fun FpScreen(content: @Composable ColumnScope.() -> Unit) {
    val s = FpTheme.spacing
    val c = FpTheme.colors
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(c.bg)
            .padding(horizontal = s.screen),
        content = content,
    )
}

@Composable
fun FpScreenHeader(
    title: String,
    subtitle: String? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    val s = FpTheme.spacing
    val c = FpTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = s.md, bottom = s.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.headlineMedium, color = c.text)
            if (subtitle != null) {
                Spacer(Modifier.height(s.xxs))
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = c.textMuted)
            }
        }
        trailing?.invoke()
    }
}

@Composable
fun FpCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    val s = FpTheme.spacing
    val c = FpTheme.colors
    val shape = RoundedCornerShape(FpTheme.radius.lg)
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .background(c.surface)
            .border(1.dp, c.border, shape)
            .padding(s.card),
        verticalArrangement = Arrangement.spacedBy(s.xs),
        content = content,
    )
}

@Composable
fun FpPrimaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    loading: Boolean = false,
    enabled: Boolean = true,
    color: Color = FpTheme.colors.brand,
) {
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        modifier = modifier
            .fillMaxWidth()
            .height(52.dp),
        shape = RoundedCornerShape(FpTheme.radius.md),
        colors = ButtonDefaults.buttonColors(
            containerColor = color,
            contentColor = FpTheme.colors.onBrand,
            disabledContainerColor = color.copy(alpha = 0.4f),
        ),
        contentPadding = PaddingValues(horizontal = FpTheme.spacing.md),
    ) {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(22.dp),
                color = FpTheme.colors.onBrand,
                strokeWidth = 2.dp,
            )
        } else {
            Text(label, style = MaterialTheme.typography.labelLarge)
        }
    }
}

@Composable
fun FpSecondaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val c = FpTheme.colors
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier
            .fillMaxWidth()
            .height(52.dp),
        shape = RoundedCornerShape(FpTheme.radius.md),
        colors = ButtonDefaults.outlinedButtonColors(
            contentColor = c.text,
            containerColor = c.surface,
        ),
        border = BorderStroke(1.dp, c.borderStrong),
    ) {
        Text(label, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
fun FpField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    singleLine: Boolean = true,
) {
    val c = FpTheme.colors
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = singleLine,
        visualTransformation = visualTransformation,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(FpTheme.radius.md),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = c.brand,
            unfocusedBorderColor = c.borderStrong,
            focusedTextColor = c.text,
            unfocusedTextColor = c.text,
            cursorColor = c.brand,
            focusedLabelColor = c.brand,
            unfocusedLabelColor = c.textMuted,
            focusedContainerColor = c.bgElevated,
            unfocusedContainerColor = c.bgElevated,
        ),
    )
}

@Composable
fun FpStatusChip(text: String, color: Color) {
    val s = FpTheme.spacing
    Text(
        text = text.uppercase(),
        style = MaterialTheme.typography.labelSmall,
        color = color,
        modifier = Modifier
            .clip(RoundedCornerShape(FpTheme.radius.full))
            .background(color.copy(alpha = 0.14f))
            .padding(horizontal = s.sm, vertical = s.xxs),
    )
}

@Composable
fun FpStatTile(
    value: String,
    label: String,
    modifier: Modifier = Modifier,
    accent: Color = FpTheme.colors.text,
) {
    val s = FpTheme.spacing
    val c = FpTheme.colors
    val shape = RoundedCornerShape(FpTheme.radius.md)
    Column(
        modifier = modifier
            .clip(shape)
            .background(c.bgElevated)
            .border(1.dp, c.border, shape)
            .padding(vertical = s.sm, horizontal = s.xs),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(value, style = MaterialTheme.typography.titleLarge, color = accent, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(2.dp))
        Text(label.uppercase(), style = MaterialTheme.typography.labelSmall, color = c.textMuted)
    }
}

@Composable
fun FpAvatar(letter: String) {
    val c = FpTheme.colors
    Box(
        modifier = Modifier
            .size(44.dp)
            .clip(CircleShape)
            .background(c.brandSoft),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            letter.take(1).uppercase(),
            style = MaterialTheme.typography.titleMedium,
            color = c.brand,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
fun FpSectionLabel(text: String) {
    Text(
        text = text.uppercase(),
        style = MaterialTheme.typography.labelMedium,
        color = FpTheme.colors.textMuted,
        modifier = Modifier.padding(top = FpTheme.spacing.md, bottom = FpTheme.spacing.xs),
    )
}

@Composable
fun FpInlineError(message: String?) {
    if (message.isNullOrBlank()) return
    Text(
        message,
        style = MaterialTheme.typography.bodySmall,
        color = FpTheme.colors.danger,
        modifier = Modifier.padding(vertical = FpTheme.spacing.xs),
    )
}

@Composable
fun FpHGap(size: Dp = FpTheme.spacing.sm) {
    Spacer(Modifier.width(size))
}

@Composable
fun FpVGap(size: Dp = FpTheme.spacing.md) {
    Spacer(Modifier.height(size))
}
