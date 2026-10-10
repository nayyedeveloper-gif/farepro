package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"telegram-clone/internal/models"
	"telegram-clone/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type CustomerHandler struct {
	customerRepo *repository.CustomerRepository
	orgRepo      *repository.OrganizationRepository
}

func NewCustomerHandler(
	customerRepo *repository.CustomerRepository,
	orgRepo *repository.OrganizationRepository,
) *CustomerHandler {
	return &CustomerHandler{customerRepo: customerRepo, orgRepo: orgRepo}
}

func (h *CustomerHandler) resolveOrg(c *gin.Context) (uuid.UUID, string, bool) {
	userID := c.MustGet("userID").(uuid.UUID)
	if orgIDVal, exists := c.Get("orgID"); exists {
		role, _ := c.Get("orgRole")
		roleStr, _ := role.(string)
		return orgIDVal.(uuid.UUID), roleStr, true
	}
	orgs, err := h.orgRepo.GetUserOrganizations(userID)
	if err != nil || len(orgs) == 0 {
		return uuid.Nil, "", false
	}
	return orgs[0].OrganizationID, orgs[0].Role, true
}

func (h *CustomerHandler) canManage(role string) bool {
	return role == "owner" || role == "admin" || role == "dispatcher"
}

func (h *CustomerHandler) List(c *gin.Context) {
	orgID, role, ok := h.resolveOrg(c)
	if !ok || !h.canManage(role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}
	limit := 100
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil {
			limit = n
		}
	}
	customers, err := h.customerRepo.ListByOrg(orgID, c.Query("q"), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list customers"})
		return
	}
	c.JSON(http.StatusOK, customers)
}

func (h *CustomerHandler) Get(c *gin.Context) {
	orgID, role, ok := h.resolveOrg(c)
	if !ok || !h.canManage(role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid customer ID"})
		return
	}
	customer, err := h.customerRepo.GetByID(orgID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}
	c.JSON(http.StatusOK, customer)
}

func (h *CustomerHandler) Create(c *gin.Context) {
	orgID, role, ok := h.resolveOrg(c)
	if !ok || !h.canManage(role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}
	var req models.CreateCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	phone := strings.TrimSpace(req.Phone)
	name := strings.TrimSpace(req.Name)
	if phone == "" || name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Name and phone are required"})
		return
	}
	if existing, err := h.customerRepo.GetByPhone(orgID, phone); err == nil && existing != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Customer with this phone already exists", "customer": existing})
		return
	}
	customer := &models.Customer{
		ID:    uuid.New(),
		OrgID: orgID,
		Name:  name,
		Phone: phone,
		Notes: strings.TrimSpace(req.Notes),
	}
	if err := h.customerRepo.Create(customer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create customer"})
		return
	}
	c.JSON(http.StatusCreated, customer)
}

func (h *CustomerHandler) Update(c *gin.Context) {
	orgID, role, ok := h.resolveOrg(c)
	if !ok || !h.canManage(role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid customer ID"})
		return
	}
	customer, err := h.customerRepo.GetByID(orgID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}
	var req models.UpdateCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Name != nil {
		customer.Name = strings.TrimSpace(*req.Name)
	}
	if req.Phone != nil {
		phone := strings.TrimSpace(*req.Phone)
		if phone == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Phone cannot be empty"})
			return
		}
		if other, err := h.customerRepo.GetByPhone(orgID, phone); err == nil && other != nil && other.ID != customer.ID {
			c.JSON(http.StatusConflict, gin.H{"error": "Phone already used by another customer"})
			return
		}
		customer.Phone = phone
	}
	if req.Notes != nil {
		customer.Notes = strings.TrimSpace(*req.Notes)
	}
	if err := h.customerRepo.Update(customer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update customer"})
		return
	}
	updated, _ := h.customerRepo.GetByID(orgID, id)
	c.JSON(http.StatusOK, updated)
}

func (h *CustomerHandler) Delete(c *gin.Context) {
	orgID, role, ok := h.resolveOrg(c)
	if !ok || (role != "owner" && role != "admin") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid customer ID"})
		return
	}
	if err := h.customerRepo.Delete(orgID, id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Customer deleted"})
}

func (h *CustomerHandler) ListTrips(c *gin.Context) {
	orgID, role, ok := h.resolveOrg(c)
	if !ok || !h.canManage(role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid customer ID"})
		return
	}
	if _, err := h.customerRepo.GetByID(orgID, id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}
	trips, err := h.customerRepo.ListTrips(orgID, id, 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list trips"})
		return
	}
	c.JSON(http.StatusOK, trips)
}
