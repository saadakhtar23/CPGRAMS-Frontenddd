import { useState, useEffect } from "react";
import { Search, FileText, Eye, MessageSquare } from "lucide-react";
import ComplaintDetails from "./ComplaintDetails";
import { useNavigate } from "react-router-dom";
import axios from 'axios';
import AssignOfficerModal from '../../components/AssignOfficerModal';

const OfficerComplaints = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
  const [modalPosition, setModalPosition] = useState({ top: 0, left: 0 });

  const handleOpenAssign = (complaintId, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setModalPosition({
      top: rect.top + window.scrollY - 40,   // move slightly up
      left: rect.left + window.scrollX - 220, // shift more to the left
    });
    setSelectedComplaintId(complaintId);
    setAssignModalOpen(true);
  };


  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        const token = localStorage.getItem("token");
        const userData = JSON.parse(localStorage.getItem("user")); // assuming you store user info after login
        const isOfficer = userData?.role === "officer";

        const endpoint = isOfficer
          ? "http://localhost:5000/api/officer/assigned-grv"
          : "http://localhost:5000/api/grievances/getallgrv";

        const response = await axios.get(endpoint, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = isOfficer ? response.data.grievances : response.data.grievances;

        const mapped = data.map((data) => ({
          id: data.uniqueID,
          title: data.title,
          citizen: data.fullName || data.user?.fullName || "N/A",
          email: data.email || data.user?.email || "N/A",
          phone: data.phoneNumber || data.user?.phoneNumber || "N/A",
          location: data.locationOfIssue || "Not specified",
          description: data.grievanceDescription || "No description",
          attachments: (data.attachments || []).map((f) => ({
            name: f.url.split("/").pop(),
            url: f.url,
          })),
          category: data.departmentName || "General",
          ministry: data.ministryName || "N/A",
          authority: data.publicAuthority || "N/A",
          status: data.status,
          assigned: !!data.assignedTo || data.status === "In Progress",
          priority: data.category?.toLowerCase() || "medium",
          date: data.dateOfIncident
            ? new Date(data.dateOfIncident).toLocaleDateString()
            : "N/A",
          feedbackGiven: data.feedbackGiven || false,
          isClosed: data.isClosed || false,
          escalatedToLeadOfficer: data.escalatedToLeadOfficer || false,
          updates: [
            ...(data.activityLog || []).map((log) => ({
              message: log.message || log.comment || "",
              date: new Date(log.timestamp).toLocaleString(),
              by: log.updatedBy?.fullName || "Unknown",
            })),
            ...(data.progressUpdates || []).map((log) => ({
              message: log.message || "",
              date: new Date(log.timestamp).toLocaleString(),
              by: log.updatedBy?.fullName || "Unknown",
            })),
          ],
        }));

        setComplaints(mapped);
      } catch (err) {
        console.error("Error fetching complaints", err);
        setError("Failed to load complaints.");
      } finally {
        setLoading(false);
      }
    };
    fetchComplaints();
  }, []);


  // const handleOpenAssign = (complaintId) => {
  //   setComplaintToAssign(complaintId);
  //   setAssignModalOpen(true);
  // };

  const handleAssignOfficer = async (complaintId, officerId) => {
    try {
      console.log("POST /assign payload", { grievanceId: complaintId, officerId }); // 👈 add this

      const token = localStorage.getItem("token");
      const res = await axios.post(
        `http://localhost:5000/api/officer/assign`,
        { grievanceId: complaintId, officerId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setComplaints((prev) =>
        prev.map((c) =>
          c.id === complaintId ? { ...c, status: "In Progress", assigned: true } : c
        )
      );

      alert("Officer assigned successfully.");
    } catch (err) {
      console.error("Assignment failed", err);
      alert("Failed to assign officer.");
    }
  };



  const filteredComplaints = complaints.filter((complaint) => {
    const matchesSearch =
      complaint.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      complaint.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      complaint.citizen.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === "all" ||
      complaint.status.toLowerCase() === filterStatus.toLowerCase();
    const matchesPriority =
      filterPriority === "all" ||
      complaint.priority.toLowerCase() === filterPriority.toLowerCase();

    return matchesSearch && matchesStatus && matchesPriority;
  });
  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "in progress":
        return "bg-blue-100 text-blue-700";
      case "resolved":
        return "bg-green-100 text-green-700";
      case "closed":
        return "bg-gray-200 text-gray-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };
  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-700";
      case "medium":
        return "bg-yellow-100 text-yellow-700";
      case "low":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };
  const handleStatusUpdate = (newStatus, finalMessage) => {
    if (!newStatus) return;
    setComplaints((prev) =>
      prev.map((c) =>
        c.id === selectedComplaint.id
          ? {
            ...c,
            status: newStatus,
            updates: [
              ...c.updates,
              {
                message:
                  newStatus === "resolved"
                    ? `marked as resolved ${finalMessage} || ""}`
                    : `status Changed to ${newStatus}`,
                date: new Date().toLocaleString(),
                by: "Officer",
              },
            ],
          }
          : c
      )
    );
  };
  const handleAddUpdate = (updateMessage) => {
    if (!updateMessage.trim()) return;
    const newUpdate = {
      message: updateMessage,
      date: new Date().toLocaleString(),
      by: "Officer",
    };
    setComplaints((prev) =>
      prev.map((c) =>
        c.id === selectedComplaint.id
          ? {
            ...c,
            updates: [
              ...c.updates,
              newUpdate,
            ]
          }
          : c
      )
    );
    setSelectedComplaint((prev) => ({
      ...prev,
      updates: [...prev.updates, newUpdate],
    }));
  };
  const handleCloseComplaint = (feedback) => {
    setComplaints((prev) =>
      prev.map((c) =>
        c.id === selectedComplaint.id
          ? {
            ...c,
            status: "closed",
            feedback: feedback || "",
            updates: [
              ...c.updates,
              {
                message: `Complaint closed with feedback: ${feedback || "No feedback provided"}`,
                date: new Date().toLocaleString(),
                by: "Officer",
              },
            ],
          }
          : c
      )
    );
  }
  if (selectedComplaint) {
    return (
      <ComplaintDetails
        selectedComplaint={selectedComplaint}
        setSelectedComplaint={setSelectedComplaint}
        getStatusColor={getStatusColor}
        getPriorityColor={getPriorityColor}
        handleStatusUpdate={handleStatusUpdate}
        handleAddUpdate={handleAddUpdate}
        handleCloseComplaint={handleCloseComplaint}
      />
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          <div className="mb-8">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg rounded-lg p-6 md:p-8">
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                Complaints Management
              </h1>
              <p className="text-blue-100 text-lg ">
                Manage and Track all Assigned complaints efficiently
              </p>
            </div>
          </div>
          {/* Filters */}
          <div className="mb-6 shadow-sm bg-white/80 backdrop-blur-sm rounded-lg p-4 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  placeholder="Search complaints..."
                  className="pl-10 border-2 border-gray-200 focus:border-blue-400 rounded-lg w-full py-2"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <select
                className="border-2 border-gray-200 focus:border-blue-400 rounded-lg w-full py-2 px-2"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="in progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>

              <select
                className="border-2 border-gray-200 focus:border-blue-400 rounded-lg w-full py-2 px-2"
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
              >
                <option value="all">All Priority</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <div className="text-sm text-gray-600 flex items-center justify-center bg-gray-50 rounded-lg px-4 py-2 border">
                <strong>{filteredComplaints.length}</strong>&nbsp;complaints found
              </div>
            </div>
          </div>

          {/* Complaints Table */}
          <div className="shadow-lg bg-white/80 backdrop-blur-sm rounded-lg overflow-hidden p-4">
            <div className="bg-gradient-to-r from-gray-50 to-slate-100 border-b border-gray-200 p-4 md:p-6">
              <div className=" text-2xl font-bold text-gray-800 flex items-center gap-3">
                <FileText className="w-6 h-6 text-indigo-600" />
                Assigned Complaints
              </div>
              <p className="text-gray-600">
                Click on any complaint to view details and manage
              </p>
            </div>

            {filteredComplaints.length > 0 ? (
              <div className="overflow-x-auto ">
                <table className="w-full text-left  ">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="p-2">Complaint ID</th>
                      <th className="p-2">Title</th>
                      <th className="p-2 hidden sm:table-cell">Citizen</th>
                      <th className="p-2 hidden md:table-cell">Category</th>
                      <th className="p-2">Status</th>
                      {/* <th className="p-2 hidden lg:table-cell">Priority</th> */}
                      <th className="p-2 hidden xl:table-cell">Date</th>
                      <th className="p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredComplaints.map((complaint) => (
                      <tr
                        key={complaint.id}
                        onClick={() => navigate(`/PGO-Dashboard/ofc-com/${complaint.id}`)} // 👈 dynamic nav
                      >
                        <td className="font-mono p-2  text-sm font-medium text-blue-600">
                          {complaint.id}
                        </td>
                        <td className="p-2 font-medium text-gray-900 max-w-xs truncate">
                          {complaint.title}
                        </td>
                        <td className="p-2 text-gray-700 hidden sm:table-cell">
                          {complaint.citizen}
                        </td>
                        <td className="p-2 text-gray-600 hidden md:table-cell">
                          {complaint.category}
                        </td>
                        <td className="p-2">
                          <span
                            className={`px-2 py-1 text-xs font-semibold ${getStatusColor(
                              complaint.status
                            )}`}
                          >
                            {complaint.status}
                          </span>
                        </td>
                        {/* <td className="p-2 hidden lg:table-cell">
                        <span
                          className={`px-2 py-1  text-xs font-semibold ${getPriorityColor(
                            complaint.priority
                          )}`}
                        >
                          {complaint.priority}
                        </span>
                      </td> */}
                        <td className="p-2 text-gray-600 hidden xl:table-cell">
                          {complaint.date}
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/PGO-Dashboard/ofc-com/${complaint.id}`); // 👈 same
                              }}
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // only open modal if not already assigned
                                if (!complaint.assigned && complaint.status !== "In Progress") {
                                  handleOpenAssign(complaint.id, e);
                                }
                              }}
                              disabled={complaint.assigned || complaint.status === "In Progress"}
                              className={`px-2 py-1 border rounded ${complaint.assigned || complaint.status === "In Progress"
                                ? "bg-green-100 text-green-700 border-green-300 cursor-not-allowed"
                                : "hover:bg-green-50 border-green-200 text-green-600"
                                }`}
                            >
                              {complaint.assigned || complaint.status === "In Progress" ? "Assigned" : "Assign"}
                            </button>

                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">
                  No complaints found matching your criteria.
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Try adjusting your search or filter settings.
                </p>
              </div>
            )}
          </div>
        </div>
        <AssignOfficerModal
          isOpen={assignModalOpen}
          onClose={() => setAssignModalOpen(false)}
          complaintId={selectedComplaintId}  // ✅ ensure this is complaint.id string
          onAssign={(complaintId, officerId) => handleAssignOfficer(complaintId, officerId)}
          position={modalPosition}
        />

      </div>
    </>
  );
};
export default OfficerComplaints;
