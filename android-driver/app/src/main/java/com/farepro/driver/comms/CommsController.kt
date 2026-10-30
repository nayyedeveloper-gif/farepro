package com.farepro.driver.comms

import com.farepro.driver.data.local.ActiveChannelStore
import com.farepro.driver.data.remote.dto.ChannelDto
import com.farepro.driver.data.repository.CommsRepository
import com.farepro.driver.domain.model.AppResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

data class PttUiState(
    val channels: List<ChannelDto> = emptyList(),
    val activeChannelId: String? = null,
    val activeChannelName: String? = null,
    val transmitting: Boolean = false,
    val uploading: Boolean = false,
    val lastStatus: String? = null,
    val error: String? = null,
    val loadingChannels: Boolean = false,
)

/**
 * Shared PTT state for Home FAB + Comms screen.
 * Hold-to-talk records locally, uploads, then posts to channel PTT history.
 */
@Singleton
class CommsController @Inject constructor(
    private val repo: CommsRepository,
    private val channelStore: ActiveChannelStore,
    private val recorder: PttAudioRecorder,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val _state = MutableStateFlow(PttUiState())
    val state: StateFlow<PttUiState> = _state.asStateFlow()

    init {
        scope.launch {
            combine(channelStore.channelIdFlow, channelStore.channelNameFlow) { id, name ->
                id to name
            }.collect { (id, name) ->
                _state.update { it.copy(activeChannelId = id, activeChannelName = name) }
            }
        }
        refreshChannels()
    }

    fun refreshChannels() {
        scope.launch {
            _state.update { it.copy(loadingChannels = true, error = null) }
            when (val res = repo.myChannels()) {
                is AppResult.Ok -> {
                    val list = res.value
                    _state.update { it.copy(channels = list, loadingChannels = false, error = null) }
                    val active = _state.value.activeChannelId
                    when {
                        list.isEmpty() -> {
                            _state.update {
                                it.copy(error = "Connecting to community channels…")
                            }
                        }
                        active.isNullOrBlank() -> selectChannel(preferredChannel(list))
                        else -> {
                            val match = list.firstOrNull { it.id == active }
                            if (match != null) selectChannel(match) else selectChannel(preferredChannel(list))
                        }
                    }
                }
                is AppResult.Err -> _state.update {
                    it.copy(loadingChannels = false, error = res.message)
                }
            }
        }
    }

    fun selectChannel(channel: ChannelDto) {
        scope.launch {
            channelStore.setActive(channel.id, channel.name)
            _state.update {
                it.copy(
                    activeChannelId = channel.id,
                    activeChannelName = channel.name,
                    lastStatus = "Channel · ${channel.name}",
                    error = null,
                )
            }
        }
    }

    /** Begin hold-to-talk. Returns false if mic busy / no channel. */
    fun startTalk(): Boolean {
        val channelId = _state.value.activeChannelId
        if (channelId.isNullOrBlank()) {
            refreshChannels()
            _state.update { it.copy(error = "Connecting channel… try again") }
            return false
        }
        if (_state.value.transmitting || _state.value.uploading) return false
        val ok = recorder.start()
        if (!ok) {
            _state.update { it.copy(error = "Mic unavailable") }
            return false
        }
        _state.update { it.copy(transmitting = true, error = null, lastStatus = "ON AIR") }
        return true
    }

    fun stopTalk() {
        if (!_state.value.transmitting) {
            recorder.cancel()
            return
        }
        val channelId = _state.value.activeChannelId
        val clip = recorder.stop()
        _state.update { it.copy(transmitting = false) }
        if (channelId.isNullOrBlank() || clip == null) {
            _state.update { it.copy(lastStatus = "Too short · hold longer") }
            return
        }
        scope.launch {
            _state.update { it.copy(uploading = true, lastStatus = "Sending…") }
            when (val res = repo.uploadAndSavePtt(channelId, clip.file, clip.durationMs)) {
                is AppResult.Ok -> _state.update {
                    it.copy(uploading = false, lastStatus = "Sent · ${clip.durationMs / 1000}s", error = null)
                }
                is AppResult.Err -> _state.update {
                    it.copy(uploading = false, error = res.message, lastStatus = "Send failed")
                }
            }
            clip.file.delete()
        }
    }

    fun clearStatus() {
        _state.update { it.copy(lastStatus = null, error = null) }
    }

    private fun preferredChannel(list: List<ChannelDto>): ChannelDto {
        fun score(ch: ChannelDto): Int {
            val d = ch.description.orEmpty()
            val n = ch.name.lowercase()
            return when {
                d == "org-community:drivers" || n.contains("drivers community") -> 0
                n.contains("on duty") -> 1
                d == "org-community:support" || n.contains("admin support") -> 2
                else -> 10
            }
        }
        return list.minBy { score(it) }
    }
}
