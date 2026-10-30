package com.farepro.driver.presentation.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.farepro.driver.data.local.TripLedgerStore
import com.farepro.driver.data.repository.DriverRepository
import com.farepro.driver.domain.model.DashboardStats
import com.farepro.driver.domain.model.TripReceipt
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import java.util.Calendar
import javax.inject.Inject

data class DashboardUiState(
    val orgName: String = "FarePro",
    val month: DashboardStats = DashboardStats(),
    val today: DashboardStats = DashboardStats(),
    val recent: List<TripReceipt> = emptyList(),
)

@HiltViewModel
class DashboardViewModel @Inject constructor(
    ledger: TripLedgerStore,
    repo: DriverRepository,
) : ViewModel() {
    val ui = combine(ledger.tripsFlow, repo.sessionMeta) { trips, meta ->
        DashboardUiState(
            orgName = meta.orgName ?: "FarePro",
            month = ledger.statsFor(trips, fromMs = startOfMonthMs()),
            today = ledger.statsFor(trips, fromMs = startOfDayMs()),
            recent = trips.take(5),
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), DashboardUiState())
}

private fun startOfMonthMs(): Long {
    val cal = Calendar.getInstance()
    cal.set(Calendar.DAY_OF_MONTH, 1)
    cal.set(Calendar.HOUR_OF_DAY, 0)
    cal.set(Calendar.MINUTE, 0)
    cal.set(Calendar.SECOND, 0)
    cal.set(Calendar.MILLISECOND, 0)
    return cal.timeInMillis
}

private fun startOfDayMs(): Long {
    val cal = Calendar.getInstance()
    cal.set(Calendar.HOUR_OF_DAY, 0)
    cal.set(Calendar.MINUTE, 0)
    cal.set(Calendar.SECOND, 0)
    cal.set(Calendar.MILLISECOND, 0)
    return cal.timeInMillis
}
