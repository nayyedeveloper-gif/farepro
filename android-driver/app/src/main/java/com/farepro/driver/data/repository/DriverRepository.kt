package com.farepro.driver.data.repository

import com.farepro.driver.data.local.SessionStore
import com.farepro.driver.data.remote.FareProApi
import com.farepro.driver.data.remote.dto.OrgLoginRequest
import com.farepro.driver.data.remote.dto.TripDto
import com.farepro.driver.data.remote.dto.TripLocationRequest
import com.farepro.driver.data.remote.dto.UpdateTripRequest
import com.farepro.driver.data.remote.dto.UserDto
import com.farepro.driver.domain.model.AppResult
import com.farepro.driver.domain.model.DriverUser
import com.farepro.driver.domain.model.FareRates
import com.farepro.driver.domain.model.TripJob
import com.farepro.driver.domain.model.WalletSummary
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import retrofit2.HttpException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DriverRepository @Inject constructor(
    private val api: FareProApi,
    private val sessionStore: SessionStore,
    private val json: Json,
) {
    val isLoggedIn: Flow<Boolean> = sessionStore.tokenFlow.map { !it.isNullOrBlank() }
    val sessionMeta = sessionStore.sessionMeta()

    suspend fun login(subdomain: String, phone: String, password: String): AppResult<DriverUser> {
        return try {
            val res = api.orgLogin(subdomain.trim().lowercase(), OrgLoginRequest(phone, password))
            sessionStore.saveSession(
                token = res.token,
                userJson = json.encodeToString(res.user),
                orgName = res.organization?.name,
                subdomain = res.organization?.subdomain ?: subdomain,
                role = res.role,
            )
            AppResult.Ok(res.user.toDomain())
        } catch (e: Exception) {
            AppResult.Err(e.toUserMessage())
        }
    }

    suspend fun logout() = sessionStore.clear()

    suspend fun loadUser(): DriverUser? =
        sessionStore.userJson()?.let { json.decodeFromString<UserDto>(it).toDomain() }

    suspend fun trips(): AppResult<List<TripJob>> = safe { api.listTrips().map { it.toDomain() } }

    suspend fun history(): AppResult<List<TripJob>> = safe { api.tripHistory().map { it.toDomain() } }

    suspend fun accept(id: String): AppResult<TripJob> = safe { api.acceptTrip(id).toDomain() }

    suspend fun reject(id: String): AppResult<Unit> = safeUnit { api.rejectTrip(id); Unit }

    suspend fun advance(id: String, status: String): AppResult<TripJob> =
        safe { api.updateTrip(id, UpdateTripRequest(status = status)).toDomain() }

    suspend fun completeTrip(id: String, distanceKm: Double, actualFare: Int): AppResult<TripJob> =
        safe {
            api.updateTrip(
                id,
                UpdateTripRequest(status = "completed", distanceKm = distanceKm, actualFare = actualFare),
            ).toDomain()
        }

    suspend fun cancel(id: String): AppResult<Unit> = safeUnit { api.cancelTrip(id); Unit }

    suspend fun pushLocation(id: String, lat: Double, lng: Double): AppResult<Unit> =
        safeUnit { api.updateTripLocation(id, TripLocationRequest(lat, lng)); Unit }

    suspend fun fareRates(): FareRates = try {
        val org = api.getOrg()
        FareRates(
            ratePerKm = org.fareRatePerKm ?: 1500,
            minimumFare = org.fareMinimum ?: 2000,
            nightMultiplier = org.fareNightMultiplier ?: 1.2,
            nightStartHour = org.fareNightStart ?: 22,
            nightEndHour = org.fareNightEnd ?: 5,
        )
    } catch (_: Exception) {
        FareRates()
    }

    suspend fun wallet(): AppResult<WalletSummary> = safe {
        val w = api.myWallet()
        WalletSummary(
            balanceMmk = w.wallet.balanceMmk,
            canReceiveJobs = w.canReceiveJobs,
            paymentInfo = w.paymentInfo,
        )
    }

    private suspend fun <T> safe(block: suspend () -> T): AppResult<T> = try {
        AppResult.Ok(block())
    } catch (e: Exception) {
        AppResult.Err(e.toUserMessage())
    }

    private suspend fun safeUnit(block: suspend () -> Unit): AppResult<Unit> = safe(block)
}

private fun UserDto.toDomain() = DriverUser(
    id = id,
    displayName = listOfNotNull(firstName, lastName).joinToString(" ").ifBlank { username ?: phone ?: id },
    phone = phone,
)

private fun TripDto.toDomain() = TripJob(
    id = id,
    customerName = customerName,
    pickupAddress = pickupAddress,
    dropoffAddress = dropoffAddress,
    status = status,
    driverId = driverId,
    customerPhone = customerPhone,
    distanceKm = distanceKm,
    estimatedFare = estimatedFare,
    actualFare = actualFare,
    pickupLat = pickupLat,
    pickupLng = pickupLng,
    dropoffLat = dropoffLat,
    dropoffLng = dropoffLng,
    driverLat = driverLat,
    driverLng = driverLng,
    bookingSource = bookingSource,
    offerExpiresAt = offerExpiresAt,
)

private fun Exception.toUserMessage(): String {
    if (this is HttpException) {
        val body = response()?.errorBody()?.string().orEmpty()
        Regex("\"error\"\\s*:\\s*\"([^\"]+)\"").find(body)?.groupValues?.getOrNull(1)
            ?.takeIf { it.isNotBlank() }
            ?.let { return it }
        return when (code()) {
            401 -> "Session expired — sign in again"
            403 -> "Not allowed for this stand role"
            else -> "Server error (${code()})"
        }
    }
    return message?.takeIf { it.isNotBlank() } ?: "Network error"
}
