package com.farepro.driver.presentation.jobs

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.farepro.driver.data.repository.DriverRepository
import com.farepro.driver.domain.model.AppResult
import com.farepro.driver.domain.model.TripJob
import com.farepro.driver.location.DriverLocationTracker
import com.farepro.driver.location.LocationController
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

data class JobsUiState(
    val loading: Boolean = true,
    val refreshing: Boolean = false,
    val online: Boolean = false,
    val trips: List<TripJob> = emptyList(),
    val history: List<TripJob> = emptyList(),
    val orgName: String? = null,
    val error: String? = null,
    val busyId: String? = null,
)

@HiltViewModel
class JobsViewModel @Inject constructor(
    private val repo: DriverRepository,
    private val locationController: LocationController,
    tracker: DriverLocationTracker,
) : ViewModel() {
    private val _ui = MutableStateFlow(JobsUiState())
    val ui = _ui.asStateFlow()
    val fix = tracker.fix.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), tracker.fix.value)
    val path = tracker.path.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private var pollJob: Job? = null

    init {
        viewModelScope.launch {
            repo.sessionMeta.collect { meta ->
                _ui.update { it.copy(orgName = meta.orgName) }
            }
        }
        refresh()
        startPolling()
    }

    fun setOnline(online: Boolean) {
        _ui.update { it.copy(online = online) }
        if (online) {
            locationController.goOnline()
            startPolling()
        } else {
            locationController.goOffline()
            pollJob?.cancel()
        }
    }

    fun refresh() {
        viewModelScope.launch {
            _ui.update { it.copy(refreshing = true, error = null) }
            val trips = repo.trips()
            val history = repo.history()
            val tripList = (trips as? AppResult.Ok)?.value.orEmpty()
            val active = tripList.firstOrNull {
                it.status in setOf("en_route", "arrived", "assigned")
            }
            if (_ui.value.online && active != null && active.status != "assigned") {
                locationController.goOnTrip(active.id)
            }
            _ui.update {
                it.copy(
                    loading = false,
                    refreshing = false,
                    trips = tripList,
                    history = (history as? AppResult.Ok)?.value.orEmpty(),
                    error = (trips as? AppResult.Err)?.message ?: (history as? AppResult.Err)?.message,
                )
            }
        }
    }

    fun accept(id: String) = act(id) {
        val res = repo.accept(id)
        if (res is AppResult.Ok) locationController.goOnTrip(id)
        res
    }

    fun reject(id: String) = actUnit(id) { repo.reject(id) }

    fun advance(id: String, status: String) = act(id) {
        val res = repo.advance(id, status)
        if (res is AppResult.Ok && status == "completed") {
            locationController.goOnline()
        }
        res
    }

    fun cancel(id: String) = actUnit(id) {
        val res = repo.cancel(id)
        if (res is AppResult.Ok) locationController.goOnline()
        res
    }

    private fun startPolling() {
        pollJob?.cancel()
        pollJob = viewModelScope.launch {
            while (isActive) {
                delay(8_000)
                if (_ui.value.online) refreshQuiet()
            }
        }
    }

    private suspend fun refreshQuiet() {
        val trips = repo.trips()
        if (trips is AppResult.Ok) {
            _ui.update { it.copy(trips = trips.value) }
        }
    }

    private fun act(id: String, block: suspend () -> AppResult<TripJob>) {
        viewModelScope.launch {
            _ui.update { it.copy(busyId = id, error = null) }
            when (val res = block()) {
                is AppResult.Ok -> refresh()
                is AppResult.Err -> _ui.update { it.copy(error = res.message) }
            }
            _ui.update { it.copy(busyId = null) }
        }
    }

    private fun actUnit(id: String, block: suspend () -> AppResult<Unit>) {
        viewModelScope.launch {
            _ui.update { it.copy(busyId = id, error = null) }
            when (val res = block()) {
                is AppResult.Ok -> refresh()
                is AppResult.Err -> _ui.update { it.copy(error = res.message) }
            }
            _ui.update { it.copy(busyId = null) }
        }
    }

    override fun onCleared() {
        pollJob?.cancel()
        super.onCleared()
    }
}
