package com.farepro.driver.presentation.receipt

import androidx.lifecycle.ViewModel
import com.farepro.driver.data.local.TripLedgerStore
import com.farepro.driver.domain.model.TripReceipt
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class ReceiptViewModel @Inject constructor(
    private val ledger: TripLedgerStore,
) : ViewModel() {
    suspend fun load(id: String): TripReceipt? = ledger.get(id)
}
