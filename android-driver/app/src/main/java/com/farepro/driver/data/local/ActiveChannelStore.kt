package com.farepro.driver.data.local

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

@Singleton
class ActiveChannelStore @Inject constructor(
    @Named("trip_ledger") private val dataStore: DataStore<Preferences>,
) {
    private val channelIdKey = stringPreferencesKey("active_ptt_channel_id")
    private val channelNameKey = stringPreferencesKey("active_ptt_channel_name")

    val channelIdFlow: Flow<String?> = dataStore.data.map { it[channelIdKey] }
    val channelNameFlow: Flow<String?> = dataStore.data.map { it[channelNameKey] }

    suspend fun setActive(id: String, name: String) {
        dataStore.edit {
            it[channelIdKey] = id
            it[channelNameKey] = name
        }
    }

    suspend fun clear() {
        dataStore.edit {
            it.remove(channelIdKey)
            it.remove(channelNameKey)
        }
    }
}
