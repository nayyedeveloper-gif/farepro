package com.farepro.driver.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class OrgLoginRequest(
    val phone: String,
    val password: String,
)

@Serializable
data class OrgLoginResponse(
    val message: String? = null,
    val token: String,
    val role: String? = null,
    val user: UserDto,
    val organization: OrganizationDto? = null,
)

@Serializable
data class UserDto(
    val id: String,
    val username: String? = null,
    val phone: String? = null,
    @SerialName("firstName") val firstName: String? = null,
    @SerialName("lastName") val lastName: String? = null,
    @SerialName("avatarUrl") val avatarUrl: String? = null,
)

@Serializable
data class OrganizationDto(
    val id: String,
    val name: String,
    val subdomain: String,
    val plan: String? = null,
)

@Serializable
data class OrgContextDto(
    val hasOrg: Boolean = false,
    val role: String? = null,
    val organization: OrganizationDto? = null,
    val token: String? = null,
)

@Serializable
data class OrgDetailsDto(
    val id: String? = null,
    val name: String? = null,
    val subdomain: String? = null,
    @SerialName("fareRatePerKm") val fareRatePerKm: Int? = null,
    @SerialName("fareMinimum") val fareMinimum: Int? = null,
    @SerialName("fareNightMultiplier") val fareNightMultiplier: Double? = null,
    @SerialName("fareNightStart") val fareNightStart: Int? = null,
    @SerialName("fareNightEnd") val fareNightEnd: Int? = null,
)

@Serializable
data class ApiErrorDto(
    val error: String? = null,
    val message: String? = null,
    val code: String? = null,
)
