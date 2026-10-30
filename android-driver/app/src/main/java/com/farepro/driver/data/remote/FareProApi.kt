package com.farepro.driver.data.remote

import com.farepro.driver.data.remote.dto.ChannelDto
import com.farepro.driver.data.remote.dto.ChannelMessageDto
import com.farepro.driver.data.remote.dto.FileUploadDto
import com.farepro.driver.data.remote.dto.MyWalletResponse
import com.farepro.driver.data.remote.dto.OrgContextDto
import com.farepro.driver.data.remote.dto.OrgDetailsDto
import com.farepro.driver.data.remote.dto.OrgLoginRequest
import com.farepro.driver.data.remote.dto.OrgLoginResponse
import com.farepro.driver.data.remote.dto.PttRecordingDto
import com.farepro.driver.data.remote.dto.SavePttRecordingBody
import com.farepro.driver.data.remote.dto.SendChannelMessageBody
import com.farepro.driver.data.remote.dto.SendTripMessageBody
import com.farepro.driver.data.remote.dto.TripDto
import com.farepro.driver.data.remote.dto.TripLocationRequest
import com.farepro.driver.data.remote.dto.TripMessageDto
import com.farepro.driver.data.remote.dto.UpdateTripRequest
import okhttp3.MultipartBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Part
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

    /** Ensures Drivers Community + Admin Support and returns membership list. */
    @POST("org/me/comms-setup")
    suspend fun ensureCommsSetup(): List<ChannelDto>

    @GET("channels/mine")
    suspend fun myChannels(): List<ChannelDto>

    @GET("channels/{id}/messages")
    suspend fun channelMessages(
        @Path("id") id: String,
        @Query("limit") limit: Int = 50,
    ): List<ChannelMessageDto>

    @POST("channels/{id}/messages")
    suspend fun sendChannelMessage(
        @Path("id") id: String,
        @Body body: SendChannelMessageBody,
    ): ChannelMessageDto

    @GET("channels/{id}/ptt-history")
    suspend fun pttHistory(
        @Path("id") id: String,
        @Query("limit") limit: Int = 30,
    ): List<PttRecordingDto>

    @POST("channels/{id}/ptt-history")
    suspend fun savePttRecording(
        @Path("id") id: String,
        @Body body: SavePttRecordingBody,
    ): PttRecordingDto

    @Multipart
    @POST("files/upload")
    suspend fun uploadFile(@Part file: MultipartBody.Part): FileUploadDto

    @GET("org/trips/{id}/messages")
    suspend fun tripMessages(@Path("id") id: String): List<TripMessageDto>

    @POST("org/trips/{id}/messages")
    suspend fun sendTripMessage(
        @Path("id") id: String,
        @Body body: SendTripMessageBody,
    ): TripMessageDto
}
