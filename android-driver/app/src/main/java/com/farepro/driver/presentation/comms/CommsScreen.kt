package com.farepro.driver.presentation.comms

import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaPlayer
import android.view.HapticFeedbackConstants
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Radio
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import com.farepro.driver.data.remote.dto.ChannelDto
import com.farepro.driver.data.remote.dto.PttRecordingDto
import com.farepro.driver.data.remote.dto.TripMessageDto
import com.farepro.driver.presentation.theme.FpTheme

@Composable
fun CommsScreen(
    onBack: () -> Unit,
    vm: CommsViewModel = hiltViewModel(),
) {
    val ui by vm.ui.collectAsState()
    val ptt by vm.ptt.collectAsState()
    val c = FpTheme.colors
    val context = LocalContext.current
    val view = LocalView.current

    val micPerm = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { /* next hold talks */ }

    fun hasMic(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED

    Column(Modifier.fillMaxSize().background(c.bg)) {
        Row(
            Modifier
                .fillMaxWidth()
                .background(c.brand)
                .padding(horizontal = 4.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Color.White)
            }
            Column(Modifier.weight(1f)) {
                Text("Communications", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Text(
                    ptt.activeChannelName?.let { it } ?: "Drivers Community · Admin Support",
                    color = Color.White.copy(alpha = 0.8f),
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            IconButton(onClick = vm::refresh) {
                Icon(Icons.Default.Refresh, contentDescription = "Retry", tint = Color.White)
            }
        }

        Row(
            Modifier
                .fillMaxWidth()
                .background(c.surface)
                .padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            TabChip("Radio", ui.tab == CommsTab.Radio) { vm.setTab(CommsTab.Radio) }
            TabChip("Community", ui.tab == CommsTab.Chat) { vm.setTab(CommsTab.Chat) }
            TabChip("Trip", ui.tab == CommsTab.Trip) { vm.setTab(CommsTab.Trip) }
        }

        val bannerError = ptt.error ?: ui.error
        if (!bannerError.isNullOrBlank() && ui.tab != CommsTab.Chat) {
            ErrorBanner(bannerError, onRetry = vm::refresh)
        }

        when (ui.tab) {
            CommsTab.Radio -> RadioPane(
                channels = ptt.channels,
                activeId = ptt.activeChannelId,
                history = ui.pttHistory,
                transmitting = ptt.transmitting,
                uploading = ptt.uploading,
                status = ptt.lastStatus,
                error = ptt.error ?: ui.error,
                loading = ui.loading || ptt.loadingChannels,
                onSelect = vm::selectChannel,
                onHoldStart = {
                    if (!hasMic()) {
                        micPerm.launch(Manifest.permission.RECORD_AUDIO)
                    } else {
                        view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
                        vm.startTalk()
                    }
                },
                onHoldEnd = {
                    view.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK)
                    vm.stopTalk()
                },
                fileUrl = vm::fileUrl,
            )
            CommsTab.Chat -> ChatPane(
                channelName = ptt.activeChannelName ?: "Select a channel",
                channels = ptt.channels,
                activeId = ptt.activeChannelId,
                onSelectChannel = vm::selectChannel,
                messages = ui.messages.map {
                    val who = it.sender?.let { u ->
                        listOfNotNull(u.firstName, u.lastName).joinToString(" ")
                            .ifBlank { u.username ?: "Member" }
                    } ?: "Member"
                    ChatLine(
                        id = it.id,
                        who = who,
                        body = it.content,
                        mine = !ui.myUserId.isNullOrBlank() && it.senderId == ui.myUserId,
                        time = formatMsgTime(it.createdAt),
                    )
                },
                draft = ui.draft,
                sending = ui.sending,
                loading = ui.loading,
                enabled = !ptt.activeChannelId.isNullOrBlank(),
                onDraft = vm::onDraft,
                onSend = vm::send,
                error = ui.error,
                onRetry = vm::refresh,
            )
            CommsTab.Trip -> TripChatPane(
                trips = ui.tripOptions,
                selectedId = ui.selectedTripId,
                messages = ui.tripMessages,
                draft = ui.draft,
                sending = ui.sending,
                onSelect = vm::selectTrip,
                onDraft = vm::onDraft,
                onSend = vm::send,
                error = ui.error,
                onRetry = vm::refresh,
            )
        }
    }
}

@Composable
private fun ErrorBanner(message: String, onRetry: () -> Unit) {
    val c = FpTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .background(c.dangerSoft)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(message, color = c.danger, fontSize = 12.sp, modifier = Modifier.weight(1f))
        Text(
            "Retry",
            color = c.brand,
            fontWeight = FontWeight.Bold,
            fontSize = 12.sp,
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .clickable(onClick = onRetry)
                .padding(horizontal = 10.dp, vertical = 4.dp),
        )
    }
}

@Composable
private fun TabChip(label: String, selected: Boolean, onClick: () -> Unit) {
    val c = FpTheme.colors
    Text(
        label,
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(if (selected) c.brand else c.surfaceRaised)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        color = if (selected) Color.White else c.textMuted,
        fontWeight = FontWeight.SemiBold,
        fontSize = 13.sp,
    )
}

private fun channelSubtitle(ch: ChannelDto): String {
    val d = ch.description.orEmpty()
    return when {
        d == "org-community:drivers" || ch.name.contains("Community", true) ->
            "All drivers · ${ch.memberCount}"
        d == "org-community:support" || ch.name.contains("Support", true) ->
            "Stand support · ${ch.memberCount}"
        else -> "${ch.memberCount} members"
    }
}

private fun formatMsgTime(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    // 2026-10-12T04:38:01.585784Z → HH:mm
    val t = iso.substringAfter('T', "")
    return if (t.length >= 5) t.take(5) else ""
}

@Composable
private fun RadioPane(
    channels: List<ChannelDto>,
    activeId: String?,
    history: List<PttRecordingDto>,
    transmitting: Boolean,
    uploading: Boolean,
    status: String?,
    error: String?,
    loading: Boolean,
    onSelect: (ChannelDto) -> Unit,
    onHoldStart: () -> Unit,
    onHoldEnd: () -> Unit,
    fileUrl: (String) -> String,
) {
    val c = FpTheme.colors
    Column(Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Channels", fontWeight = FontWeight.SemiBold, color = c.text, fontSize = 13.sp)
        if (channels.isEmpty()) {
            Text(
                if (loading) "Connecting to channels…"
                else "No channels yet. Tap refresh in the header.",
                color = c.textMuted,
                fontSize = 13.sp,
            )
        } else {
            LazyColumn(
                modifier = Modifier.height(150.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                items(channels, key = { it.id }) { ch ->
                    val on = ch.id == activeId
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (on) c.brandSoft else c.surface)
                            .border(1.dp, if (on) c.brand else c.border, RoundedCornerShape(12.dp))
                            .clickable { onSelect(ch) }
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(if (on) c.brand else c.surfaceRaised),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                Icons.Default.Radio,
                                null,
                                tint = if (on) Color.White else c.textMuted,
                                modifier = Modifier.size(18.dp),
                            )
                        }
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(ch.name, fontWeight = FontWeight.SemiBold, color = c.text, fontSize = 14.sp)
                            Text(channelSubtitle(ch), color = c.textMuted, fontSize = 11.sp)
                        }
                        if (on) {
                            Text("LIVE", color = c.brand, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                        }
                    }
                }
            }
        }

        Box(Modifier.fillMaxWidth().weight(0.4f), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                val bg = when {
                    transmitting -> Color(0xFFE53935)
                    uploading -> c.warning
                    else -> c.brand
                }
                Box(
                    Modifier
                        .size(120.dp)
                        .clip(CircleShape)
                        .background(bg)
                        .border(
                            width = if (transmitting) 4.dp else 0.dp,
                            color = Color.White,
                            shape = CircleShape,
                        )
                        .pointerInput(activeId) {
                            detectTapGestures(
                                onPress = {
                                    onHoldStart()
                                    tryAwaitRelease()
                                    onHoldEnd()
                                },
                            )
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    if (uploading) {
                        CircularProgressIndicator(Modifier.size(32.dp), color = Color.White, strokeWidth = 3.dp)
                    } else {
                        Icon(Icons.Default.Mic, null, tint = Color.White, modifier = Modifier.size(44.dp))
                    }
                }
                Spacer(Modifier.height(10.dp))
                Text(
                    when {
                        transmitting -> "ON AIR · release to send"
                        uploading -> "Sending voice…"
                        error != null -> error
                        else -> status ?: "Hold to talk · release to send"
                    },
                    color = when {
                        transmitting -> Color(0xFFE53935)
                        error != null -> c.danger
                        else -> c.textMuted
                    },
                    fontSize = 13.sp,
                    fontWeight = if (transmitting) FontWeight.Bold else FontWeight.Medium,
                )
            }
        }

        Text("Recent voice", fontWeight = FontWeight.SemiBold, color = c.text, fontSize = 13.sp)
        if (loading && history.isEmpty()) {
            CircularProgressIndicator(Modifier.size(22.dp), color = c.brand, strokeWidth = 2.dp)
        }
        LazyColumn(
            modifier = Modifier.weight(0.6f),
            verticalArrangement = Arrangement.spacedBy(6.dp),
            contentPadding = PaddingValues(bottom = 12.dp),
        ) {
            items(history, key = { it.id }) { rec ->
                PttHistoryRow(rec, fileUrl(rec.fileUrl))
            }
        }
    }
}

@Composable
private fun PttHistoryRow(rec: PttRecordingDto, url: String) {
    val c = FpTheme.colors
    var playing by remember { mutableStateOf(false) }
    var player by remember { mutableStateOf<MediaPlayer?>(null) }
    DisposableEffect(Unit) {
        onDispose {
            player?.release()
            player = null
        }
    }
    val name = rec.user?.let {
        listOfNotNull(it.firstName, it.lastName).joinToString(" ").ifBlank { it.username ?: "Driver" }
    } ?: "Driver"
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(c.surface)
            .border(1.dp, c.border, RoundedCornerShape(12.dp))
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(c.brandSoft)
                .clickable {
                    if (playing) {
                        player?.stop()
                        player?.release()
                        player = null
                        playing = false
                    } else {
                        runCatching {
                            val mp = MediaPlayer().apply {
                                setDataSource(url)
                                setOnCompletionListener {
                                    playing = false
                                    release()
                                    player = null
                                }
                                prepare()
                                start()
                            }
                            player = mp
                            playing = true
                        }
                    }
                },
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                if (playing) Icons.Default.Mic else Icons.Default.PlayArrow,
                null,
                tint = c.brand,
            )
        }
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(name, fontWeight = FontWeight.SemiBold, color = c.text, fontSize = 14.sp)
            Text(
                "${rec.durationMs / 1000}s · ${formatMsgTime(rec.createdAt)}",
                color = c.textMuted,
                fontSize = 12.sp,
            )
        }
    }
}

data class ChatLine(
    val id: String,
    val who: String,
    val body: String,
    val mine: Boolean,
    val time: String = "",
)

@Composable
private fun ChatPane(
    channelName: String,
    channels: List<ChannelDto>,
    activeId: String?,
    onSelectChannel: (ChannelDto) -> Unit,
    messages: List<ChatLine>,
    draft: String,
    sending: Boolean,
    loading: Boolean,
    enabled: Boolean,
    onDraft: (String) -> Unit,
    onSend: () -> Unit,
    error: String?,
    onRetry: () -> Unit,
) {
    val c = FpTheme.colors
    val listState = rememberLazyListState()
    LaunchedEffect(messages.size, activeId) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.lastIndex)
    }
    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .background(c.surface)
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            channels.forEach { ch ->
                val on = ch.id == activeId
                Text(
                    ch.name,
                    modifier = Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .background(if (on) c.brand else c.surfaceRaised)
                        .border(1.dp, if (on) c.brand else c.border, RoundedCornerShape(20.dp))
                        .clickable { onSelectChannel(ch) }
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                    color = if (on) Color.White else c.text,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 12.sp,
                    maxLines = 1,
                )
            }
        }

        Text(
            channelName,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
            color = c.textMuted,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
        )

        if (!error.isNullOrBlank()) {
            ErrorBanner(error, onRetry = onRetry)
        }

        Box(Modifier.weight(1f).fillMaxWidth()) {
            when {
                loading && messages.isEmpty() -> {
                    CircularProgressIndicator(
                        Modifier.align(Alignment.Center).size(28.dp),
                        color = c.brand,
                        strokeWidth = 2.dp,
                    )
                }
                messages.isEmpty() -> {
                    Column(
                        Modifier.align(Alignment.Center).padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text("No messages yet", color = c.text, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "Say hello to the team — drivers and stand support share this channel.",
                            color = c.textMuted,
                            fontSize = 13.sp,
                        )
                    }
                }
                else -> {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = PaddingValues(top = 8.dp, bottom = 12.dp),
                    ) {
                        items(messages, key = { it.id }) { msg ->
                            MessageBubble(msg)
                        }
                    }
                }
            }
        }
        Composer(draft, sending, enabled, onDraft, onSend, placeholder = "Message $channelName…")
    }
}

@Composable
private fun MessageBubble(msg: ChatLine) {
    val c = FpTheme.colors
    val bubble = if (msg.mine) c.brand else c.surface
    val textColor = if (msg.mine) Color.White else c.text
    val metaColor = if (msg.mine) Color.White.copy(alpha = 0.75f) else c.textMuted
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = if (msg.mine) Arrangement.End else Arrangement.Start,
    ) {
        Column(
            Modifier
                .widthIn(max = 300.dp)
                .clip(
                    RoundedCornerShape(
                        topStart = 16.dp,
                        topEnd = 16.dp,
                        bottomStart = if (msg.mine) 16.dp else 4.dp,
                        bottomEnd = if (msg.mine) 4.dp else 16.dp,
                    ),
                )
                .background(bubble)
                .then(
                    if (!msg.mine) Modifier.border(1.dp, c.border, RoundedCornerShape(16.dp, 16.dp, 16.dp, 4.dp))
                    else Modifier,
                )
                .padding(horizontal = 12.dp, vertical = 8.dp),
        ) {
            if (!msg.mine) {
                Text(msg.who, color = c.brand, fontWeight = FontWeight.SemiBold, fontSize = 11.sp)
                Spacer(Modifier.height(2.dp))
            }
            Text(msg.body, color = textColor, fontSize = 15.sp, lineHeight = 20.sp)
            if (msg.time.isNotBlank()) {
                Text(
                    msg.time,
                    color = metaColor,
                    fontSize = 10.sp,
                    modifier = Modifier.align(Alignment.End).padding(top = 4.dp),
                )
            }
        }
    }
}

@Composable
private fun TripChatPane(
    trips: List<TripOption>,
    selectedId: String?,
    messages: List<TripMessageDto>,
    draft: String,
    sending: Boolean,
    onSelect: (String) -> Unit,
    onDraft: (String) -> Unit,
    onSend: () -> Unit,
    error: String?,
    onRetry: () -> Unit,
) {
    val c = FpTheme.colors
    Column(Modifier.fillMaxSize()) {
        if (!error.isNullOrBlank()) {
            ErrorBanner(error, onRetry = onRetry)
        }
        if (trips.isEmpty()) {
            Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text("No active trip for messaging", color = c.textMuted)
            }
        } else {
            Row(
                Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                trips.forEach { t ->
                    val on = t.id == selectedId
                    Column(
                        Modifier
                            .widthIn(max = 220.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (on) c.brandSoft else c.surface)
                            .border(1.dp, if (on) c.brand else c.border, RoundedCornerShape(12.dp))
                            .clickable { onSelect(t.id) }
                            .padding(10.dp),
                    ) {
                        Text(
                            t.title,
                            fontWeight = FontWeight.SemiBold,
                            color = c.text,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            fontSize = 13.sp,
                        )
                        Text(
                            t.subtitle,
                            color = c.textMuted,
                            fontSize = 11.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
            LazyColumn(
                modifier = Modifier.weight(1f).padding(horizontal = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(bottom = 8.dp),
            ) {
                items(messages, key = { it.id }) { msg ->
                    val mine = msg.senderRole.equals("driver", ignoreCase = true)
                    MessageBubble(
                        ChatLine(
                            id = msg.id,
                            who = msg.senderRole.replaceFirstChar { it.uppercase() },
                            body = msg.body,
                            mine = mine,
                            time = formatMsgTime(msg.createdAt),
                        ),
                    )
                }
            }
        }
        Composer(
            draft,
            sending,
            trips.isNotEmpty() && selectedId != null,
            onDraft,
            onSend,
            placeholder = "Message about this trip…",
        )
    }
}

@Composable
private fun Composer(
    draft: String,
    sending: Boolean,
    enabled: Boolean,
    onDraft: (String) -> Unit,
    onSend: () -> Unit,
    placeholder: String = "Message…",
) {
    val c = FpTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .background(c.surface)
            .border(width = 1.dp, color = c.border, shape = RoundedCornerShape(0.dp))
            .padding(horizontal = 10.dp, vertical = 10.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        Box(
            Modifier
                .weight(1f)
                .heightIn(min = 44.dp)
                .clip(RoundedCornerShape(22.dp))
                .background(c.bg)
                .border(1.dp, c.border, RoundedCornerShape(22.dp))
                .padding(horizontal = 14.dp, vertical = 12.dp),
        ) {
            if (draft.isEmpty()) {
                Text(placeholder, color = c.textMuted, fontSize = 14.sp)
            }
            BasicTextField(
                value = draft,
                onValueChange = onDraft,
                enabled = enabled && !sending,
                textStyle = TextStyle(color = c.text, fontSize = 14.sp),
                cursorBrush = SolidColor(c.brand),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        Spacer(Modifier.width(8.dp))
        Box(
            Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(if (enabled && draft.isNotBlank() && !sending) c.brand else c.surfaceRaised)
                .clickable(enabled = enabled && !sending && draft.isNotBlank(), onClick = onSend),
            contentAlignment = Alignment.Center,
        ) {
            if (sending) {
                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = Color.White)
            } else {
                Icon(
                    Icons.AutoMirrored.Filled.Send,
                    contentDescription = "Send",
                    tint = if (enabled && draft.isNotBlank()) Color.White else c.textMuted,
                    modifier = Modifier.size(20.dp),
                )
            }
        }
    }
}
