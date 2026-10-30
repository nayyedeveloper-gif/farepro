package com.farepro.driver.presentation.account

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.farepro.driver.data.local.DriverProfile
import com.farepro.driver.data.local.DriverProfileStore
import com.farepro.driver.data.local.RatesCache
import com.farepro.driver.data.local.TripLedgerStore
import com.farepro.driver.data.local.TripSessionStore
import com.farepro.driver.data.local.VehicleType
import com.farepro.driver.data.repository.DriverRepository
import com.farepro.driver.domain.model.AppResult
import com.farepro.driver.domain.model.DemandCatalogItem
import com.farepro.driver.domain.model.DriverUser
import com.farepro.driver.domain.model.FareRates
import com.farepro.driver.domain.model.WalletSummary
import com.farepro.driver.meter.MeterSessionManager
import com.farepro.driver.overlay.MeterBubbleService
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import javax.inject.Inject

data class AccountUiState(
    val user: DriverUser? = null,
    val orgName: String? = null,
    val subdomain: String? = null,
    val role: String? = null,
    val wallet: WalletSummary? = null,
    val profile: DriverProfile = DriverProfile(),
    val nameDraft: String = "",
    val plateDraft: String = "7K-0000",
    val addressDraft: String = "",
    val vehicleType: VehicleType = VehicleType.CAR,
    val photoUri: String = "",
    val rates: FareRates = FareRates(),
    val demandCatalog: List<DemandCatalogItem> = emptyList(),
    val tripCount: Int = 0,
    val editing: Boolean = false,
    val saving: Boolean = false,
    val savedFlash: Boolean = false,
    val permsGranted: Int = 0,
    val permsTotal: Int = 0,
    val error: String? = null,
)

@HiltViewModel
class AccountViewModel @Inject constructor(
    private val repo: DriverRepository,
    private val tripSessionStore: TripSessionStore,
    private val ledger: TripLedgerStore,
    private val profileStore: DriverProfileStore,
    private val ratesCache: RatesCache,
    private val meter: MeterSessionManager,
    @ApplicationContext private val context: Context,
) : ViewModel() {
    private val _ui = MutableStateFlow(AccountUiState())
    val ui = _ui.asStateFlow()

    init {
        viewModelScope.launch {
            repo.sessionMeta.collect { meta ->
                _ui.update {
                    it.copy(
                        orgName = meta.orgName,
                        subdomain = meta.subdomain,
                        role = meta.role,
                    )
                }
            }
        }
        viewModelScope.launch {
            profileStore.profileFlow.collect { profile ->
                _ui.update { state ->
                    if (state.editing) {
                        state.copy(profile = profile)
                    } else {
                        state.copy(
                            profile = profile,
                            nameDraft = profile.displayName.ifBlank { state.user?.displayName.orEmpty() },
                            plateDraft = profile.plateNumber,
                            addressDraft = profile.address,
                            vehicleType = profile.vehicleType,
                            photoUri = profile.photoUri,
                        )
                    }
                }
            }
        }
        viewModelScope.launch {
            ledger.tripsFlow.collect { trips ->
                _ui.update { it.copy(tripCount = trips.size) }
            }
        }
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            val user = repo.loadUser()
            val wallet = repo.wallet()
            val rates = ratesCache.loadRates()
            val catalog = ratesCache.loadDemandCatalog()
            runCatching {
                val bundle = repo.loadFareBundle()
                ratesCache.saveRates(bundle.rates)
                ratesCache.saveDemandCatalog(bundle.demandCatalog)
                meter.setRates(bundle.rates)
                meter.setDemandCatalog(bundle.demandCatalog)
                _ui.update { it.copy(rates = bundle.rates, demandCatalog = bundle.demandCatalog) }
            }.onFailure {
                _ui.update { it.copy(rates = rates, demandCatalog = catalog) }
            }
            _ui.update { state ->
                val name = state.profile.displayName.ifBlank { user?.displayName.orEmpty() }
                state.copy(
                    user = user,
                    wallet = (wallet as? AppResult.Ok)?.value,
                    error = (wallet as? AppResult.Err)?.message,
                    nameDraft = if (state.editing) state.nameDraft else name,
                )
            }
        }
    }

    fun setPermsSummary(granted: Int, total: Int) {
        _ui.update { it.copy(permsGranted = granted, permsTotal = total) }
    }

    fun startEditing() {
        val s = _ui.value
        _ui.update {
            it.copy(
                editing = true,
                savedFlash = false,
                nameDraft = s.profile.displayName.ifBlank { s.user?.displayName.orEmpty() },
                plateDraft = s.profile.plateNumber,
                addressDraft = s.profile.address,
                vehicleType = s.profile.vehicleType,
                photoUri = s.profile.photoUri,
            )
        }
    }

    fun cancelEditing() {
        val s = _ui.value
        _ui.update {
            it.copy(
                editing = false,
                nameDraft = s.profile.displayName.ifBlank { s.user?.displayName.orEmpty() },
                plateDraft = s.profile.plateNumber,
                addressDraft = s.profile.address,
                vehicleType = s.profile.vehicleType,
                photoUri = s.profile.photoUri,
            )
        }
    }

    fun onNameDraft(v: String) = _ui.update { it.copy(nameDraft = v, savedFlash = false) }
    fun onPlateDraft(v: String) = _ui.update { it.copy(plateDraft = v, savedFlash = false) }
    fun onAddressDraft(v: String) = _ui.update { it.copy(addressDraft = v, savedFlash = false) }
    fun onVehicleType(type: VehicleType) = _ui.update { it.copy(vehicleType = type, savedFlash = false) }

    fun onPhotoPicked(uri: Uri?) {
        if (uri == null) return
        viewModelScope.launch {
            val saved = withContext(Dispatchers.IO) { copyPhotoLocally(uri) }
            if (saved != null) {
                _ui.update { it.copy(photoUri = saved, savedFlash = false) }
                if (!_ui.value.editing) {
                    profileStore.save(photoUri = saved)
                }
            }
        }
    }

    fun saveProfile() {
        viewModelScope.launch {
            _ui.update { it.copy(saving = true, error = null) }
            val s = _ui.value
            profileStore.save(
                displayName = s.nameDraft.trim(),
                plateNumber = s.plateDraft.trim().ifBlank { "7K-0000" },
                vehicleType = s.vehicleType,
                address = s.addressDraft.trim(),
                photoUri = s.photoUri,
            )
            // Keep meter plate in sync (same DataStore key)
            ledger.setPlateNumber(s.plateDraft.trim().ifBlank { "7K-0000" })
            _ui.update { it.copy(saving = false, editing = false, savedFlash = true) }
        }
    }

    fun signOut(onDone: () -> Unit) {
        viewModelScope.launch {
            meter.stop()
            tripSessionStore.clear()
            MeterBubbleService.clearTrip(context)
            repo.logout()
            onDone()
        }
    }

    private fun copyPhotoLocally(uri: Uri): String? = runCatching {
        val dest = File(context.filesDir, "profile_photo.jpg")
        context.contentResolver.openInputStream(uri)?.use { input ->
            dest.outputStream().use { output -> input.copyTo(output) }
        } ?: return null
        dest.absolutePath
    }.getOrNull()
}
