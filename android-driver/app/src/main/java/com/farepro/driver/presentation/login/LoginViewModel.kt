package com.farepro.driver.presentation.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.farepro.driver.BuildConfig
import com.farepro.driver.data.repository.DriverRepository
import com.farepro.driver.domain.model.AppResult
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val subdomain: String = "",
    val phone: String = "",
    val password: String = "",
    val loading: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val repo: DriverRepository,
) : ViewModel() {
    val isLoggedIn = repo.isLoggedIn.stateIn(viewModelScope, SharingStarted.Eagerly, false)

    private val _ui = MutableStateFlow(
        // Prefill demo only in debug — production starts blank
        if (BuildConfig.DEBUG) {
            LoginUiState(subdomain = "demo", phone = "09000000201", password = "Demo@2026")
        } else {
            LoginUiState()
        },
    )
    val ui = _ui.asStateFlow()

    fun onSubdomain(v: String) = _ui.update { it.copy(subdomain = v, error = null) }
    fun onPhone(v: String) = _ui.update { it.copy(phone = v, error = null) }
    fun onPassword(v: String) = _ui.update { it.copy(password = v, error = null) }

    fun login(onSuccess: () -> Unit) {
        val s = _ui.value
        if (s.subdomain.isBlank() || s.phone.isBlank() || s.password.isBlank()) {
            _ui.update { it.copy(error = "Stand code, phone, and password required") }
            return
        }
        viewModelScope.launch {
            _ui.update { it.copy(loading = true, error = null) }
            when (val res = repo.login(s.subdomain.trim().lowercase(), s.phone.trim(), s.password)) {
                is AppResult.Ok -> {
                    _ui.update { it.copy(loading = false) }
                    onSuccess()
                }
                is AppResult.Err -> _ui.update { it.copy(loading = false, error = res.message) }
            }
        }
    }
}
