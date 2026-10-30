package com.farepro.driver.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ChannelDto(
    val id: String,
    val name: String = "",
    val description: String? = null,
    @SerialName("avatarUrl") val avatarUrl: String? = null,
    @SerialName("isPrivate") val isPrivate: Boolean = false,
    @SerialName("memberCount") val memberCount: Int = 0,
)

@Serializable
data class ChannelMessageDto(
    val id: String,
    @SerialName("channelId") val channelId: String = "",
    @SerialName("senderId") val senderId: String = "",
    val content: String = "",
    val type: String = "text",
    @SerialName("fileUrl") val fileUrl: String? = null,
    @SerialName("createdAt") val createdAt: String? = null,
    val sender: UserDto? = null,
)

@Serializable
data class SendChannelMessageBody(
    val content: String,
    val type: String = "text",
)

@Serializable
data class TripMessageDto(
    val id: String,
    @SerialName("tripId") val tripId: String = "",
    @SerialName("senderRole") val senderRole: String = "",
    val body: String = "",
    @SerialName("createdAt") val createdAt: String? = null,
)

@Serializable
data class SendTripMessageBody(val body: String)

@Serializable
data class FileUploadDto(
    val url: String = "",
    val name: String? = null,
    val size: Long? = null,
    val type: String? = null,
)

@Serializable
data class PttRecordingDto(
    val id: String,
    @SerialName("channelId") val channelId: String = "",
    @SerialName("userId") val userId: String = "",
    @SerialName("fileUrl") val fileUrl: String = "",
    @SerialName("durationMs") val durationMs: Int = 0,
    @SerialName("createdAt") val createdAt: String? = null,
    val user: UserDto? = null,
)

@Serializable
data class SavePttRecordingBody(
    @SerialName("fileUrl") val fileUrl: String,
    @SerialName("durationMs") val durationMs: Int = 0,
)
