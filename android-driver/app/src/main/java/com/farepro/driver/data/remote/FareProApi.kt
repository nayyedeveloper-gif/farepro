package com.farepro.driver.data.remote

import com.farepro.driver.data.remote.dto.MyWalletResponse
import com.farepro.driver.data.remote.dto.OrgContextDto
import com.farepro.driver.data.remote.dto.OrgDetailsDto
import com.farepro.driver.data.remote.dto.OrgLoginRequest
import com.farepro.driver.data.remote.dto.OrgLoginResponse
import com.farepro.driver.data.remote.dto.TripDto
import com.farepro.driver.data.remote.dto.TripLocationRequest
import com.farepro.driver.data.remote.dto.UpdateTripRequest
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface FareProApi {
    @POST("org/login")
    suspend fun orgLogin(
        @Query("subdomain") subdomain: String,
        @Body body: OrgLoginRequest,
    ): OrgLoginResponse

    @GET("org/context")
    suspend fun orgContext(): OrgContextDto

    @GET("org")
    suspend fun getOrg(): OrgDetailsDto

    @GET("org/trips")
    suspend fun listTrips(): List<TripDto>

    @GET("org/trips/history")
    suspend fun tripHistory(): List<TripDto>

    @POST("org/trips/{id}/accept")
    suspend fun acceptTrip(@Path("id") id: String): TripDto

    @POST("org/trips/{id}/reject")
    suspend fun rejectTrip(@Path("id") id: String): TripDto

    @PATCH("org/trips/{id}")
    suspend fun updateTrip(
        @Path("id") id: String,
        @Body body: UpdateTripRequest,
    ): TripDto

    @POST("org/trips/{id}/location")
    suspend fun updateTripLocation(
        @Path("id") id: String,
        @Body body: TripLocationRequest,
    )

    @POST("org/trips/{id}/cancel")
    suspend fun cancelTrip(
        @Path("id") id: String,
        @Body body: Map<String, String> = mapOf("reason" to "Driver cancelled"),
    )

    @GET("org/me/wallet")
    suspend fun myWallet(): MyWalletResponse
}
