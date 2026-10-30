package com.farepro.driver.presentation.comms

import android.Manifest
import android.content.pm.PackageManager
import android.view.HapticFeedbackConstants
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import com.farepro.driver.presentation.theme.FpTheme

/**
 * Zello-style home PTT:
 * - Hold mic to talk on active community channel
 * - Tap channel chip opens Comms
 */
@Composable
fun PttHoldFab(
    onOpenComms: () -> Unit,
    modifier: Modifier = Modifier,
    vm: CommsViewModel = hiltViewModel(),
) {
    val ptt by vm.ptt.collectAsState()
    val c = FpTheme.colors
    val context = LocalContext.current
    val view = LocalView.current

    val micPerm = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { /* next press will talk */ }

    fun hasMic(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED

    val pulse = rememberInfiniteTransition(label = "ptt")
    val pulseScale by pulse.animateFloat(
        initialValue = 1f,
        targetValue = 1.08f,
        animationSpec = infiniteRepeatable(tween(500), RepeatMode.Reverse),
        label = "scale",
    )

    Column(modifier = modifier, horizontalAlignment = Alignment.End) {
        Box(
            Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(Color.White.copy(alpha = 0.95f))
                .border(1.dp, c.border, RoundedCornerShape(8.dp))
                .clickable(onClick = onOpenComms)
                .padding(horizontal = 10.dp, vertical = 6.dp),
        ) {
            Text(
                ptt.activeChannelName ?: "Connecting…",
                color = c.text,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
            )
        }
        val bg = when {
            ptt.transmitting -> Color(0xFFE53935)
            ptt.uploading -> c.warning
            else -> c.brand
        }
        Box(
            Modifier
                .padding(top = 8.dp)
                .size(76.dp)
                .scale(if (ptt.transmitting) pulseScale else 1f)
                .clip(CircleShape)
                .background(bg)
                .border(
                    width = if (ptt.transmitting) 3.dp else 0.dp,
                    color = Color.White.copy(alpha = 0.85f),
                    shape = CircleShape,
                )
                .pointerInput(ptt.activeChannelId) {
                    detectTapGestures(
                        onTap = { onOpenComms() },
                        onPress = {
                            if (!hasMic()) {
                                micPerm.launch(Manifest.permission.RECORD_AUDIO)
                                return@detectTapGestures
                            }
                            view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
                            vm.startTalk()
                            tryAwaitRelease()
                            view.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK)
                            vm.stopTalk()
                        },
                    )
                },
            contentAlignment = Alignment.Center,
        ) {
            when {
                ptt.uploading -> CircularProgressIndicator(
                    Modifier.size(28.dp),
                    color = Color.White,
                    strokeWidth = 2.dp,
                )
                else -> Icon(
                    Icons.Default.Mic,
                    contentDescription = "PTT",
                    tint = Color.White,
                    modifier = Modifier.size(34.dp),
                )
            }
        }
        Text(
            when {
                ptt.transmitting -> "ON AIR"
                ptt.uploading -> "Sending…"
                ptt.error != null -> ptt.error!!
                else -> ptt.lastStatus ?: "Hold to talk"
            },
            color = Color.White,
            fontSize = 10.sp,
            fontWeight = if (ptt.transmitting) FontWeight.Bold else FontWeight.Medium,
            modifier = Modifier
                .padding(top = 6.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(
                    when {
                        ptt.transmitting -> Color(0xFFE53935)
                        ptt.error != null -> Color(0xFFB71C1C)
                        else -> Color.Black.copy(alpha = 0.55f)
                    },
                )
                .padding(horizontal = 8.dp, vertical = 3.dp),
        )
    }
}
