package com.farepro.driver.data.repository

import com.farepro.driver.BuildConfig
import com.farepro.driver.data.remote.FareProApi
import com.farepro.driver.data.remote.dto.ApiErrorDto
import com.farepro.driver.data.remote.dto.ChannelDto
import com.farepro.driver.data.remote.dto.ChannelMessageDto
import com.farepro.driver.data.remote.dto.PttRecordingDto
import com.farepro.driver.data.remote.dto.SavePttRecordingBody
import com.farepro.driver.data.remote.dto.SendChannelMessageBody
import com.farepro.driver.data.remote.dto.SendTripMessageBody
import com.farepro.driver.data.remote.dto.TripMessageDto
import com.farepro.driver.domain.model.AppResult
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import retrofit2.HttpException
import java.io.File
import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CommsRepository @Inject constructor(
    private val api: FareProApi,
    private val json: Json,
) {
    /**
     * Provisions community channels then returns the driver's radio/chat list
     * (hides private driver-ptt DMs; prefers community channels first).
     */
    suspend fun myChannels(): AppResult<List<ChannelDto>> = safe {
        val fromSetup = runCatching { api.ensureCommsSetup() }.getOrNull()
        val raw = fromSetup ?: api.myChannels()
        sortForDriverComms(raw)
    }

    suspend fun channelMessages(channelId: String): AppResult<List<ChannelMessageDto>> = safe {
        api.channelMessages(channelId).reversed()
    }

    suspend fun sendChannelMessage(channelId: String, text: String): AppResult<ChannelMessageDto> = safe {
        api.sendChannelMessage(channelId, SendChannelMessageBody(content = text.trim(), type = "text"))
    }

    suspend fun pttHistory(channelId: String): AppResult<List<PttRecordingDto>> = safe {
        api.pttHistory(channelId)
    }

    suspend fun tripMessages(tripId: String): AppResult<List<TripMessageDto>> = safe {
        api.tripMessages(tripId)
    }

    suspend fun sendTripMessage(tripId: String, text: String): AppResult<TripMessageDto> = safe {
        api.sendTripMessage(tripId, SendTripMessageBody(body = text.trim()))
    }

    suspend fun uploadAndSavePtt(channelId: String, file: File, durationMs: Int): AppResult<PttRecordingDto> =
        safe {
            val body = file.asRequestBody("audio/mp4".toMediaTypeOrNull())
            val part = MultipartBody.Part.createFormData("file", file.name, body)
            val uploaded = api.uploadFile(part)
            val url = uploaded.url.ifBlank { throw IllegalStateException("Empty upload url") }
            api.savePttRecording(channelId, SavePttRecordingBody(fileUrl = url, durationMs = durationMs))
        }

    fun absoluteFileUrl(path: String): String {
        if (path.startsWith("http://") || path.startsWith("https://")) return path
        val base = BuildConfig.API_BASE_URL.removeSuffix("/api/").removeSuffix("/api")
        return if (path.startsWith("/")) "$base$path" else "$base/$path"
    }

    private fun sortForDriverComms(raw: List<ChannelDto>): List<ChannelDto> {
        val visible = raw.filterNot { it.description.orEmpty().startsWith("driver-ptt:") }
        fun rank(ch: ChannelDto): Int {
            val d = ch.description.orEmpty()
            val n = ch.name.lowercase()
            return when {
                d == "org-community:drivers" || n.contains("drivers community") -> 0
                d == "org-community:support" || n.contains("admin support") -> 1
                n.contains("on duty") -> 2
                n == "dispatch" -> 3
                else -> 10
            }
        }
        return visible.sortedWith(compareBy({ rank(it) }, { it.name.lowercase() }))
    }

    private suspend fun <T> safe(block: suspend () -> T): AppResult<T> = try {
        AppResult.Ok(block())
    } catch (e: Exception) {
        AppResult.Err(friendlyError(e))
    }

    private fun friendlyError(e: Exception): String = when (e) {
        is UnknownHostException, is ConnectException ->
            "Cannot reach stand server · check Wi‑Fi and that FarePro is online"
        is SocketTimeoutException ->
            "Server timeout · try again"
        is IOException -> {
            val raw = e.message.orEmpty()
            if (raw.contains("Failed to connect", ignoreCase = true) ||
                raw.contains("Connection refused", ignoreCase = true)
            ) {
                "Cannot reach stand server · check Wi‑Fi and that FarePro is online"
            } else {
                raw.ifBlank { "Network error" }
            }
        }
        is HttpException -> {
            val fromBody = runCatching {
                e.response()?.errorBody()?.string()?.let { body ->
                    json.decodeFromString(ApiErrorDto.serializer(), body).error
                        ?: json.decodeFromString(ApiErrorDto.serializer(), body).message
                }
            }.getOrNull()
            fromBody?.takeIf { it.isNotBlank() } ?: "Request failed (${e.code()})"
        }
        else -> e.message?.takeIf { it.isNotBlank() } ?: "Something went wrong"
    }
}
