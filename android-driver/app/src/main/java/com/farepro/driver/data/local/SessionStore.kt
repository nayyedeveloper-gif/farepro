package com.farepro.driver.data.local

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SessionStore @Inject constructor(
    private val dataStore: DataStore<Preferences>,
) {
    private val tokenKey = stringPreferencesKey("jwt_token")
    private val userJsonKey = stringPreferencesKey("user_json")
    private val orgNameKey = stringPreferencesKey("org_name")
    private val orgSubdomainKey = stringPreferencesKey("org_subdomain")
    private val roleKey = stringPreferencesKey("org_role")

    val tokenFlow: Flow<String?> = dataStore.data.map { it[tokenKey] }

    suspend fun token(): String? = dataStore.data.first()[tokenKey]

    suspend fun userJson(): String? = dataStore.data.first()[userJsonKey]

    suspend fun saveSession(
        token: String,
        userJson: String,
        orgName: String?,
        subdomain: String?,
        role: String?,
    ) {
        dataStore.edit {
            it[tokenKey] = token
            it[userJsonKey] = userJson
            if (orgName != null) it[orgNameKey] = orgName else it.remove(orgNameKey)
            if (subdomain != null) it[orgSubdomainKey] = subdomain else it.remove(orgSubdomainKey)
            if (role != null) it[roleKey] = role else it.remove(roleKey)
        }
    }

    suspend fun clear() {
        dataStore.edit { it.clear() }
    }

    fun sessionMeta(): Flow<SessionMeta> = dataStore.data.map {
        SessionMeta(
            token = it[tokenKey],
            userJson = it[userJsonKey],
            orgName = it[orgNameKey],
            subdomain = it[orgSubdomainKey],
            role = it[roleKey],
        )
    }
}

data class SessionMeta(
    val token: String?,
    val userJson: String?,
    val orgName: String?,
    val subdomain: String?,
    val role: String?,
)
