package com.farepro.driver.presentation.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.farepro.driver.data.local.TripSessionStore
import com.farepro.driver.data.repository.DriverRepository
import com.farepro.driver.domain.model.AppResult
import com.farepro.driver.domain.model.DriverUser
import com.farepro.driver.domain.model.WalletSummary
import com.farepro.driver.meter.MeterSessionManager
import com.farepro.driver.overlay.MeterBubbleService
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AccountUiState(
    val user: DriverUser? = null,
    val orgName: String? = null,
    val role: String? = null,
    val wallet: WalletSummary? = null,
    val error: String? = null,
)

@HiltViewModel
class AccountViewModel @Inject constructor(
    private val repo: DriverRepository,
    private val tripSessionStore: TripSessionStore,
    private val meter: MeterSessionManager,
    @ApplicationContext private val context: Context,
) : ViewModel() {
    private val _ui = MutableStateFlow(AccountUiState())
    val ui = _ui.asStateFlow()

    init {
        viewModelScope.launch {
            repo.sessionMeta.collect { meta ->
                _ui.update { it.copy(orgName = meta.orgName, role = meta.role) }
            }
        }
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            val user = repo.loadUser()
            val wallet = repo.wallet()
            _ui.update {
                it.copy(
                    user = user,
                    wallet = (wallet as? AppResult.Ok)?.value,
                    error = (wallet as? AppResult.Err)?.message,
                )
            }
        }
    }

    fun signOut(onDone: () -> Unit) {
        viewModelScope.launch {
            meter.stop()
            tripSessionStore.clear()
            MeterBubbleService.hide(context)
            repo.logout()
            onDone()
        }
    }
}
