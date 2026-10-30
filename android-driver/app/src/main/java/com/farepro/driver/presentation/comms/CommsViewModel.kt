package com.farepro.driver.presentation.comms

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.farepro.driver.comms.CommsController
import com.farepro.driver.comms.PttUiState
import com.farepro.driver.data.local.SessionStore
import com.farepro.driver.data.remote.dto.ChannelDto
import com.farepro.driver.data.remote.dto.ChannelMessageDto
import com.farepro.driver.data.remote.dto.PttRecordingDto
import com.farepro.driver.data.remote.dto.TripMessageDto
import com.farepro.driver.data.remote.dto.UserDto
import com.farepro.driver.data.repository.CommsRepository
import com.farepro.driver.data.repository.DriverRepository
import com.farepro.driver.domain.model.AppResult
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import javax.inject.Inject

enum class CommsTab { Radio, Chat, Trip }

data class TripOption(
    val id: String,
    val title: String,
    val subtitle: String,
    val status: String,
)

data class CommsUiState(
    val tab: CommsTab = CommsTab.Radio,
    val loading: Boolean = false,
    val myUserId: String? = null,
    val messages: List<ChannelMessageDto> = emptyList(),
    val pttHistory: List<PttRecordingDto> = emptyList(),
    val tripOptions: List<TripOption> = emptyList(),
    val selectedTripId: String? = null,
    val tripMessages: List<TripMessageDto> = emptyList(),
    val draft: String = "",
    val sending: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class CommsViewModel @Inject constructor(
    private val controller: CommsController,
    private val repo: CommsRepository,
    private val driverRepo: DriverRepository,
    private val sessionStore: SessionStore,
    private val json: Json,
) : ViewModel() {
    val ptt = controller.state.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), PttUiState())

    private val _ui = MutableStateFlow(CommsUiState())
    val ui = _ui.asStateFlow()

    private var lastLoadedChannel: String? = null

    init {
        viewModelScope.launch {
            val id = sessionStore.userJson()?.let {
                runCatching { json.decodeFromString(UserDto.serializer(), it).id }.getOrNull()
            }
            _ui.update { it.copy(myUserId = id) }
        }
        refresh()
        viewModelScope.launch {
            controller.state.collect { s ->
                val id = s.activeChannelId ?: return@collect
                if (id != lastLoadedChannel) {
                    lastLoadedChannel = id
                    loadChannelContent(id)
                }
            }
        }
    }

    fun refresh() {
        controller.refreshChannels()
        refreshTrips()
        ptt.value.activeChannelId?.let { loadChannelContent(it) }
    }

    fun setTab(tab: CommsTab) {
        _ui.update { it.copy(tab = tab, error = null) }
        if (tab == CommsTab.Trip) refreshTrips()
        if (tab == CommsTab.Chat || tab == CommsTab.Radio) {
            controller.refreshChannels()
            ptt.value.activeChannelId?.let { loadChannelContent(it) }
        }
    }

    fun selectChannel(channel: ChannelDto) {
        controller.selectChannel(channel)
        lastLoadedChannel = channel.id
        loadChannelContent(channel.id)
    }

    fun onDraft(v: String) = _ui.update { it.copy(draft = v) }

    fun send() {
        when (_ui.value.tab) {
            CommsTab.Chat -> sendChannelChat()
            CommsTab.Trip -> sendTripChat()
            CommsTab.Radio -> Unit
        }
    }

    fun selectTrip(tripId: String) {
        _ui.update { it.copy(selectedTripId = tripId) }
        loadTripMessages(tripId)
    }

    fun startTalk() = controller.startTalk()
    fun stopTalk() = controller.stopTalk()
    fun fileUrl(path: String) = repo.absoluteFileUrl(path)

    private fun sendChannelChat() {
        val channelId = ptt.value.activeChannelId ?: run {
            _ui.update { it.copy(error = "Select a channel first") }
            return
        }
        val text = _ui.value.draft.trim()
        if (text.isBlank()) return
        viewModelScope.launch {
            _ui.update { it.copy(sending = true, error = null) }
            when (val res = repo.sendChannelMessage(channelId, text)) {
                is AppResult.Ok -> _ui.update {
                    it.copy(sending = false, draft = "", messages = it.messages + res.value, error = null)
                }
                is AppResult.Err -> _ui.update { it.copy(sending = false, error = res.message) }
            }
        }
    }

    private fun sendTripChat() {
        val tripId = _ui.value.selectedTripId ?: return
        val text = _ui.value.draft.trim()
        if (text.isBlank()) return
        viewModelScope.launch {
            _ui.update { it.copy(sending = true, error = null) }
            when (val res = repo.sendTripMessage(tripId, text)) {
                is AppResult.Ok -> _ui.update {
                    it.copy(sending = false, draft = "", tripMessages = it.tripMessages + res.value, error = null)
                }
                is AppResult.Err -> _ui.update { it.copy(sending = false, error = res.message) }
            }
        }
    }

    private fun refreshTrips() {
        viewModelScope.launch {
            when (val res = driverRepo.trips()) {
                is AppResult.Ok -> {
                    val opts = res.value
                        .filter { it.status !in listOf("completed", "cancelled") }
                        .map {
                            TripOption(
                                id = it.id,
                                title = it.customerName.ifBlank { "Trip" },
                                subtitle = "${it.pickupAddress} → ${it.dropoffAddress}",
                                status = it.status,
                            )
                        }
                    _ui.update { state ->
                        val selected = state.selectedTripId?.takeIf { id -> opts.any { it.id == id } }
                            ?: opts.firstOrNull()?.id
                        state.copy(tripOptions = opts, selectedTripId = selected, error = null)
                    }
                    _ui.value.selectedTripId?.let { loadTripMessages(it) }
                }
                is AppResult.Err -> _ui.update { it.copy(error = res.message) }
            }
        }
    }

    private fun loadChannelContent(channelId: String) {
        viewModelScope.launch {
            _ui.update { it.copy(loading = true, error = null) }
            val msgs = repo.channelMessages(channelId)
            val hist = repo.pttHistory(channelId)
            _ui.update {
                it.copy(
                    loading = false,
                    messages = (msgs as? AppResult.Ok)?.value.orEmpty(),
                    pttHistory = (hist as? AppResult.Ok)?.value.orEmpty(),
                    error = (msgs as? AppResult.Err)?.message ?: (hist as? AppResult.Err)?.message,
                )
            }
        }
    }

    private fun loadTripMessages(tripId: String) {
        viewModelScope.launch {
            when (val res = repo.tripMessages(tripId)) {
                is AppResult.Ok -> _ui.update { it.copy(tripMessages = res.value, error = null) }
                is AppResult.Err -> _ui.update { it.copy(error = res.message) }
            }
        }
    }
}
