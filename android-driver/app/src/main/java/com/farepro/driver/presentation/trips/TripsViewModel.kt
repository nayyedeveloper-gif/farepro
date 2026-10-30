package com.farepro.driver.presentation.trips

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.farepro.driver.data.local.TripLedgerStore
import com.farepro.driver.data.repository.DriverRepository
import com.farepro.driver.domain.model.TripReceipt
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

@HiltViewModel
class TripsViewModel @Inject constructor(
    private val ledger: TripLedgerStore,
    repo: DriverRepository,
) : ViewModel() {
    val trips = ledger.tripsFlow.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val orgName = repo.sessionMeta
        .map { it.orgName ?: "FarePro" }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "FarePro")
}
